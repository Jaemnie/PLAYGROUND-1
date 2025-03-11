import { NextResponse } from 'next/server';
import redis from '@/lib/redis';
import { createClient } from '@supabase/supabase-js';

// 접속자 세션 만료 시간 (초)
const SESSION_EXPIRY = 300; // 5분 (실제 서비스에서는 더 길게 설정 가능)

// Supabase 클라이언트 초기화 함수
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

export async function GET() {
  try {
    // 모든 세션 키 가져오기
    const sessionKeys = await redis.keys('session:*');
    
    if (!sessionKeys.length) {
      return NextResponse.json({ 
        count: 0,
        uniqueCount: 0,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // 모든 세션 데이터 가져오기
    const sessionData = await Promise.all(
      sessionKeys.map(async (key) => {
        const data = await redis.get(key);
        if (!data) return null;
        try {
          return JSON.parse(data as string);
        } catch (e) {
          return null;
        }
      })
    );
    
    // null 값 제거 및 유효한 세션만 필터링
    const validSessions = sessionData.filter(session => 
      session && 
      session.lastActive && 
      (Date.now() - session.lastActive < SESSION_EXPIRY * 1000)
    );
    
    // 총 세션 수
    const totalCount = validSessions.length;
    
    // 고유 사용자 수 계산 (userId가 있는 경우만)
    const uniqueUserIds = new Set();
    validSessions.forEach(session => {
      if (session.userId) {
        uniqueUserIds.add(session.userId);
      }
    });
    
    const uniqueCount = uniqueUserIds.size;
    
    // Redis에 최신 카운트 저장
    await redis.set('active_users_count', totalCount.toString());
    await redis.set('unique_active_users_count', uniqueCount.toString());
    
    return NextResponse.json({ 
      count: totalCount,
      uniqueCount: uniqueCount,
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
    const { sessionId, userId } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.', success: false },
        { status: 400 }
      );
    }
    
    const sessionKey = `session:${sessionId}`;
    const now = Date.now();
    
    // 세션 데이터 구조 개선
    const sessionData = {
      lastActive: now,
      userId: userId || null, // 로그인한 사용자의 경우 userId 저장
      createdAt: now
    };
    
    // 기존 세션 확인
    const existingSession = await redis.get(sessionKey);
    let isNewSession = false;
    
    if (existingSession) {
      // 기존 세션 업데이트
      try {
        const parsedSession = JSON.parse(existingSession as string);
        sessionData.createdAt = parsedSession.createdAt || now;
        
        // userId가 없었는데 새로 생긴 경우 업데이트
        if (!parsedSession.userId && userId) {
          sessionData.userId = userId;
        }
      } catch (e) {
        console.error('세션 데이터 파싱 오류:', e);
      }
    } else {
      // 새 세션 생성
      isNewSession = true;
    }
    
    // 세션 데이터 저장
    await redis.set(
      sessionKey, 
      JSON.stringify(sessionData), 
      { ex: SESSION_EXPIRY }
    );
    
    // 새 세션인 경우에만 카운터 증가
    if (isNewSession) {
      await redis.incr('active_users_count');
    }
    
    // 프로필 확인 (userId가 있는 경우)
    let hasProfile = false;
    if (userId) {
      const supabase = getSupabaseClient();
      
      if (supabase) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single();
        
        hasProfile = !!data;
      }
    }
    
    return NextResponse.json({ 
      success: true,
      isNewSession,
      hasProfile,
      sessionData
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