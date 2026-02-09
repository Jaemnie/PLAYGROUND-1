import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'
import { MarketQueue } from '@/services/market-queue'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const queue = MarketQueue.getInstance()
    const scheduler = await MarketScheduler.getInstance()

    await queue.addTask({
      type: 'market-close',
      priority: 3,
      execute: async () => {
        console.log('[market-close] 장 마감 처리 실행')
        await scheduler.setClosingPrices()
        console.log('[market-close] 장 마감 처리 완료')
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[market-close] Market closing failed:', error)
    return NextResponse.json({ error: 'Market closing failed' }, { status: 500 })
  }
}
