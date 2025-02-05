import { MarketScheduler } from '@/services/market-scheduler'
import { NextResponse } from 'next/server'

const scheduler = new MarketScheduler()

export async function GET() {
  try {
    await scheduler.start()
    return NextResponse.json({ message: '스케줄러가 시작되었습니다.' })
  } catch (error) {
    return NextResponse.json(
      { error: '스케줄러 시작 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 