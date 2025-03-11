import { NextResponse } from 'next/server';
import redis from '@/lib/redis';

// 세션 만료 시 접속자 수 감소 API
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
    const sessionExists = await redis.exists(sessionKey);
    
    // 세션이 존재하는 경우에만 삭제하고 카운터 감소
    if (sessionExists) {
      await redis.del(sessionKey);
      
      // 활성 사용자 수가 0 이상인 경우에만 감소
      const currentCount = await redis.get('active_users_count') || '0';
      if (parseInt(currentCount as string, 10) > 0) {
        await redis.decr('active_users_count');
      }
      
      return NextResponse.json({ 
        success: true,
        message: '세션이 만료되었습니다.'
      });
    }
    
    return NextResponse.json({ 
      success: false,
      message: '세션을 찾을 수 없습니다.'
    });
  } catch (error) {
    console.error('세션 만료 처리 오류:', error);
    return NextResponse.json(
      { 
        error: '세션 만료 처리 중 오류가 발생했습니다.',
        success: false 
      },
      { status: 500 }
    );
  }
} 