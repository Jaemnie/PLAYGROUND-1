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
      console.log('[news-update] 장 운영 시간이 아닙니다.')
      return NextResponse.json({ success: true, skipped: true, reason: 'market_closed' })
    }

    const queue = MarketQueue.getInstance()

    await queue.addTask({
      type: 'news-update',
      priority: 2,
      execute: async () => {
        console.log('[news-update] 뉴스 업데이트 태스크 실행 시작')
        await scheduler.updateNews()
        console.log('[news-update] 뉴스 업데이트 태스크 실행 완료')
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[news-update] News update failed:', error)
    return NextResponse.json({ error: 'News update failed' }, { status: 500 })
  }
}
