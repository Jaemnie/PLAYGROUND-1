import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'
import { MarketQueue } from '@/services/market-queue'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
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
        console.log('[market-update] 마켓 업데이트 태스크 실행 완료')
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[market-update] Market update failed:', error)
    return NextResponse.json({ error: 'Market update failed' }, { status: 500 })
  }
}
