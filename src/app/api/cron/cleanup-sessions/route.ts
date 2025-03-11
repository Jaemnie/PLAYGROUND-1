import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import redis from '@/lib/redis'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!
})

// 세션 만료 시간 (밀리초)
const SESSION_EXPIRY_MS = 10 * 60 * 1000; // 10분

export async function POST(req: Request) {
  const signature = req.headers.get('upstash-signature')
  
  if (!signature) {
    console.error('Missing upstash-signature header')
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.text()

  try {
    const isValid = await receiver.verify({
      signature,
      body
    })

    if (!isValid) {
      console.error('Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }

    // 만료된 세션 정리 로직
    const result = await cleanupExpiredSessions()
    
    return NextResponse.json({ 
      success: true,
      ...result
    })
  } catch (error) {
    console.error('세션 정리 실패:', error)
    return NextResponse.json({ error: '세션 정리 실패' }, { status: 500 })
  }
}

// 세션 데이터 타입 정의
interface SessionData {
  sessionId: string;
  userId?: string;
  lastActive?: number;
  createdAt?: number;
  [key: string]: any;
}

/**
 * Redis에서 만료된 세션을 찾아 정리하는 함수
 */
async function cleanupExpiredSessions() {
  try {
    // 모든 세션 키 가져오기
    const sessionKeys = await redis.keys('session:*')
    
    if (!sessionKeys.length) {
      return { 
        cleanedCount: 0,
        message: '정리할 세션이 없습니다.'
      }
    }
    
    let cleanedCount = 0
    const now = Date.now()
    
    // 세션 데이터 및 만료된 세션 추적
    const sessionsData: SessionData[] = []
    const expiredSessionIds: string[] = []
    const expiredUserIds = new Set<string>()
    
    // 각 세션 확인 및 만료된 세션 식별
    for (const sessionKey of sessionKeys) {
      const sessionData = await redis.get(sessionKey)
      
      if (!sessionData) {
        // 세션 데이터가 없으면 키 삭제
        await redis.del(sessionKey)
        cleanedCount++
        continue
      }
      
      try {
        const session = JSON.parse(sessionData as string)
        const sessionId = sessionKey.split(':')[1]
        
        // 세션 데이터 저장
        sessionsData.push({
          sessionId,
          ...session
        })
        
        // 세션에 lastActive 필드가 있고, 일정 시간 이상 지났으면 만료 처리
        if (session.lastActive && (now - session.lastActive > SESSION_EXPIRY_MS)) {
          expiredSessionIds.push(sessionId)
          
          // 사용자 ID가 있는 경우 추적
          if (session.userId) {
            expiredUserIds.add(session.userId)
          }
        }
      } catch (error) {
        console.error(`세션 데이터 파싱 오류 (${sessionKey}):`, error)
        // 오류가 있는 세션 데이터는 삭제
        await redis.del(sessionKey)
        cleanedCount++
      }
    }
    
    // 만료된 세션 처리
    for (const sessionId of expiredSessionIds) {
      await expireSession(sessionId)
      cleanedCount++
    }
    
    // 고유 사용자 수 업데이트
    if (expiredUserIds.size > 0) {
      // 만료되지 않은 세션에서 사용자 ID 확인
      const activeUserIds = new Set<string>()
      
      sessionsData.forEach(session => {
        if (!expiredSessionIds.includes(session.sessionId) && session.userId) {
          activeUserIds.add(session.userId)
        }
      })
      
      // 만료된 사용자 중 다른 세션이 없는 사용자 수 계산
      let uniqueExpiredCount = 0
      
      expiredUserIds.forEach(userId => {
        if (!activeUserIds.has(userId)) {
          uniqueExpiredCount++
        }
      })
      
      // 고유 사용자 수 업데이트
      if (uniqueExpiredCount > 0) {
        const uniqueCount = await redis.get('unique_active_users_count') || '0'
        const newUniqueCount = Math.max(0, parseInt(uniqueCount as string, 10) - uniqueExpiredCount)
        await redis.set('unique_active_users_count', newUniqueCount.toString())
      }
    }
    
    // 총 세션 수 업데이트
    const remainingSessionCount = sessionKeys.length - cleanedCount
    await redis.set('active_users_count', remainingSessionCount.toString())
    
    return {
      cleanedCount,
      totalSessions: sessionKeys.length,
      remainingSessions: remainingSessionCount,
      message: `${cleanedCount}개의 만료된 세션이 정리되었습니다.`
    }
  } catch (error) {
    console.error('세션 정리 중 오류 발생:', error)
    throw error
  }
}

/**
 * 세션 만료 처리 함수
 */
async function expireSession(sessionId: string) {
  try {
    const sessionKey = `session:${sessionId}`
    const sessionExists = await redis.exists(sessionKey)
    
    // 세션이 존재하는 경우에만 삭제
    if (sessionExists) {
      await redis.del(sessionKey)
      return true
    }
    
    return false
  } catch (error) {
    console.error('세션 만료 처리 오류:', error)
    throw error
  }
} 