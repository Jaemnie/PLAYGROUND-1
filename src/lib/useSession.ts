import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
const registerSession = async (sessionId: string) => {
  try {
    await fetch('/api/active-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
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
    
    // 세션 등록
    registerSession(sessionId);
    
    // 주기적으로 세션 갱신 (60초마다)
    const interval = setInterval(() => {
      if (isActive) {
        registerSession(sessionId);
      }
    }, 60000);
    
    // 페이지 언로드 시 세션 만료 처리
    const handleBeforeUnload = () => {
      isActive = false;
      expireSession(sessionId);
    };
    
    // 페이지 가시성 변경 감지
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        isActive = true;
        registerSession(sessionId);
      } else {
        isActive = false;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 클린업 함수
    return () => {
      isActive = false;
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      expireSession(sessionId);
    };
  }, []);
} 