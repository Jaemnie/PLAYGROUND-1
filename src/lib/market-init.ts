import { MarketScheduler } from '@/services/market-scheduler'

export async function initializeMarket() {
  // 테스트 환경에서는 실행하지 않음
  if (process.env.NODE_ENV === 'test') return

  try {
    // 절대 URL 사용
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/scheduler/init`)
    
    if (!response.ok) {
      throw new Error('스케줄러 초기화 실패')
    }
    console.log('마켓 스케줄러가 성공적으로 초기화되었습니다.')
  } catch (error) {
    console.error('마켓 스케줄러 초기화 실패:', error)
  }
} 