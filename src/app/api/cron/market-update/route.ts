import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'
import { MarketQueue } from '@/services/market-queue'
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

    const scheduler = await MarketScheduler.getInstance()

    if (!scheduler.isMarketOpen()) {
      console.log('[market-update] 장 운영 시간이 아닙니다.')
      return NextResponse.json({ success: true, skipped: true, reason: 'market_closed' })
    }

    const queue = MarketQueue.getInstance()

    await queue.addTask({
      type: 'market-update',
      priority: 1,
      execute: async () => {
        console.log('[market-update] 마켓 업데이트 태스크 실행 시작')
        await scheduler.updateMarket()

        // 최대 포트폴리오 가치 갱신 (현재가 기준)
        try {
          const statsTracker = new StatsTracker()
          await statsTracker.initialize()
          await statsTracker.updateAllMaxPortfolioValues()
        } catch {
          // 실패해도 마켓 업데이트는 성공으로 처리
        }

        console.log('[market-update] 마켓 업데이트 태스크 실행 완료')
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[market-update] Market update failed:', error)
    return NextResponse.json({ error: 'Market update failed' }, { status: 500 })
  }
}
