import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'
import { MarketQueue } from '@/services/market-queue'
import { OrderExecutor } from '@/services/order-executor'
import { StatsTracker } from '@/services/stats-tracker'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!
})

export async function POST(req: Request) {
  const signature = req.headers.get('upstash-signature')
  if (!signature) {
    console.error('Missing upstash-signature header')
    return new Response('Unauthorized', { status: 401 })
  }
  
  const body = await req.text()

  try {
    const isValid = await receiver.verify({
      signature,
      body
    })

    if (!isValid) {
      console.error('Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const queue = MarketQueue.getInstance()
    const scheduler = await MarketScheduler.getInstance()
    
    await queue.addTask({
      type: 'market-close',
      priority: 3,
      execute: async () => {
        console.log('[market-close] 장 마감 처리 실행')
        await scheduler.setClosingPrices()

        // 전체 사용자 최대 포트폴리오 가치 갱신
        try {
          const statsTracker = new StatsTracker()
          await statsTracker.initialize()
          await statsTracker.updateAllMaxPortfolioValues()
          console.log('[market-close] 최대 포트폴리오 통계 갱신 완료')
        } catch (statsError) {
          console.error('[market-close] 포트폴리오 통계 갱신 중 오류:', statsError)
        }

        // 만료된 조건 주문 정리 + 에스크로 환불
        try {
          const orderExecutor = new OrderExecutor()
          await orderExecutor.expireOrders()
          console.log('[market-close] 만료 조건 주문 정리 완료')
        } catch (orderError) {
          console.error('[market-close] 만료 주문 처리 중 오류:', orderError)
        }

        console.log('[market-close] 장 마감 처리 완료')
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[market-close] Market closing failed:', error)
    return NextResponse.json({ error: 'Market closing failed' }, { status: 500 })
  }
}
