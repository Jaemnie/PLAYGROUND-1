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
      // 세션 데이터 가져오기
      const sessionData = await redis.get(sessionKey);
      let userId = null;
      
      // 세션 데이터에서 userId 추출
      if (sessionData) {
        try {
          const parsedData = JSON.parse(sessionData as string);
          userId = parsedData.userId;
        } catch (e) {
          console.error('세션 데이터 파싱 오류:', e);
        }
      }
      
      // 세션 삭제
      await redis.del(sessionKey);
      
      // 활성 사용자 수가 0 이상인 경우에만 감소
      const currentCount = await redis.get('active_users_count') || '0';
      if (parseInt(currentCount as string, 10) > 0) {
        await redis.decr('active_users_count');
      }
      
      // 로그인한 사용자인 경우 고유 사용자 수 업데이트
      if (userId) {
        // 해당 사용자의 다른 세션이 있는지 확인
        const allSessionKeys = await redis.keys('session:*');
        const allSessionData = await Promise.all(
          allSessionKeys.map(async (key) => {
            if (key === sessionKey) return null; // 이미 삭제된 세션은 제외
            const data = await redis.get(key);
            if (!data) return null;
            try {
              return JSON.parse(data as string);
            } catch (e) {
              return null;
            }
          })
        );
        
        // 같은 userId를 가진 다른 세션이 있는지 확인
        const hasSameUserSession = allSessionData.some(
          session => session && session.userId === userId
        );
        
        // 같은 userId를 가진 다른 세션이 없는 경우에만 고유 사용자 수 감소
        if (!hasSameUserSession) {
          const uniqueCount = await redis.get('unique_active_users_count') || '0';
          if (parseInt(uniqueCount as string, 10) > 0) {
            await redis.decr('unique_active_users_count');
          }
        }
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