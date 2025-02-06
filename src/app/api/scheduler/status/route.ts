import { MarketScheduler } from '@/services/market-scheduler'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const scheduler = await MarketScheduler.getInstance()
    const status = [
      {
        id: '1',
        jobType: 'market_update',
        status: scheduler.isRunning ? 'running' : 'stopped',
        lastRun: scheduler.lastMarketUpdateTime,
        nextRun: scheduler.getNextRunTime('market_update')
      },
      {
        id: '2',
        jobType: 'news_generation',
        status: scheduler.isRunning ? 'running' : 'stopped',
        lastRun: scheduler.lastNewsUpdateTime,
        nextRun: scheduler.getNextRunTime('news_generation')
      }
    ]

    return NextResponse.json({ status })
  } catch (error) {
    return NextResponse.json(
      { error: '스케줄러 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
