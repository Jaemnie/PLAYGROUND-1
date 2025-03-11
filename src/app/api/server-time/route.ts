import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const serverTime = new Date().toISOString();
    return NextResponse.json({ serverTime });
  } catch (error) {
    console.error('서버 시간 조회 오류:', error);
    return NextResponse.json({ 
      serverTime: new Date().toISOString(),
      error: '서버 시간 조회 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
} 