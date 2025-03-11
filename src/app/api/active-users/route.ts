import { NextResponse } from 'next/server';
import redis from '@/lib/redis';

// 접속자 세션 만료 시간 (초)
const SESSION_EXPIRY = 60; // 1분 (실제 서비스에서는 더 길게 설정 가능)

export async function GET() {
  try {
    // 현재 활성 사용자 수 가져오기
    const activeUsers = await redis.get('active_users_count') || '0';
    
    return NextResponse.json({ 
      count: parseInt(activeUsers as string, 10),
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('접속자 수 조회 오류:', error);
    return NextResponse.json(
      { 
        error: '접속자 수를 가져오는 중 오류가 발생했습니다.',
        success: false 
      },
      { status: 500 }
    );
  }
}

// 사용자 접속 등록 API
export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.', success: false },
        { status: 400 }
      );
    }
    
    const sessionKey = `session:${sessionId}`;
    const isNewSession = await redis.set(sessionKey, '1', { nx: true, ex: SESSION_EXPIRY });
    
    // 새 세션인 경우에만 카운터 증가
    if (isNewSession) {
      await redis.incr('active_users_count');
    } else {
      // 기존 세션 만료 시간 갱신
      await redis.expire(sessionKey, SESSION_EXPIRY);
    }
    
    // 세션 만료 시 카운터 감소하는 스크립트 등록
    // 실제 구현에서는 더 복잡한 로직이 필요할 수 있음
    
    return NextResponse.json({ 
      success: true,
      isNewSession
    });
  } catch (error) {
    console.error('접속자 등록 오류:', error);
    return NextResponse.json(
      { 
        error: '접속자 등록 중 오류가 발생했습니다.',
        success: false 
      },
      { status: 500 }
    );
  }
} 