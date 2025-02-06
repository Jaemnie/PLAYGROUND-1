import { MarketScheduler } from '@/services/market-scheduler';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const scheduler = await MarketScheduler.getInstance();
    await scheduler.cleanup();
    return NextResponse.json({ message: '스케줄러가 정지되었습니다.' });
  } catch (error) {
    console.error('스케줄러 종료 실패:', error);
    return NextResponse.json(
      { error: '스케줄러 종료 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 