import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createClientBrowser } from '@/lib/supabase/client';

// 세션 ID를 로컬 스토리지에서 가져오거나 새로 생성
const getSessionId = () => {
  if (typeof window === 'undefined') return '';
  
  let sessionId = localStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem('session_id', sessionId);
  }
  return sessionId;
};

// 세션 등록 및 갱신 함수
const registerSession = async (sessionId: string, userId?: string) => {
  try {
    await fetch('/api/active-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, userId }),
    });
  } catch (error) {
    console.error('세션 등록 오류:', error);
  }
};

// 세션 만료 처리 함수
const expireSession = async (sessionId: string) => {
  try {
    await fetch('/api/session-expired', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });
  } catch (error) {
    console.error('세션 만료 처리 오류:', error);
  }
};

// 세션 관리 훅
export function useSession() {
  useEffect(() => {
    // 브라우저 환경에서만 실행
    if (typeof window === 'undefined') return;
    
    const sessionId = getSessionId();
    let isActive = true;
    let userId: string | undefined;
    
    // Supabase 클라이언트 초기화 및 사용자 정보 가져오기
    const supabase = createClientBrowser();
    
    // 사용자 정보 가져오기
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
      
      // 세션 등록 (사용자 ID 포함)
      registerSession(sessionId, userId);
    };
    
    // 초기 사용자 정보 가져오기
    getUserId();
    
    // 주기적으로 세션 갱신 (3분마다)
    const interval = setInterval(() => {
      if (isActive) {
        // 최신 사용자 정보로 세션 갱신
        getUserId();
      }
    }, 180000); // 3분
    
    // 페이지 언로드 시 세션 만료 처리
    const handleBeforeUnload = () => {
      isActive = false;
      expireSession(sessionId);
    };
    
    // 페이지 가시성 변경 감지
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        isActive = true;
        getUserId();
      } else {
        isActive = false;
      }
    };
    
    // 사용자 활동 감지 (마우스 이동, 키보드 입력 등)
    const handleUserActivity = () => {
      if (!isActive) {
        isActive = true;
        getUserId();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    document.addEventListener('click', handleUserActivity);
    
    // 클린업 함수
    return () => {
      isActive = false;
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
      document.removeEventListener('click', handleUserActivity);
      expireSession(sessionId);
    };
  }, []); // 의존성 배열 비움 (컴포넌트 마운트 시 한 번만 실행)
} 