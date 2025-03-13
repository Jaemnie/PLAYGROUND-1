import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { BustabitAdminClient } from './bustabit-admin-client'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// 베팅 데이터 타입 정의
interface BetStat {
  id: string;
  bet_amount: number;
  cashout_multiplier: number | null;
  profit: number | null;
  user_id: string;
  created_at: string;
  user?: {
    nickname: string;
  };
}

export default async function BustabitAdminPage() {
  const supabase = await createClient()
  
  // 사용자 인증 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }
  
  // 관리자 권한 확인
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .single()
  
  if (!adminUser) {
    redirect('/dashboard')
  }
  
  // 스케줄러 상태를 데이터베이스에서 직접 조회
  let schedulerStatus = 'stopped'
  try {
    const { data: schedulerData } = await supabase
      .from('bustabit_scheduler')
      .select('status')
      .single()
    
    schedulerStatus = schedulerData?.status || 'stopped'
  } catch (error) {
    console.error('스케줄러 상태 조회 오류:', error)
    // 기본값 사용
  }
  
  // 게임 통계 조회
  const { data: gameStats } = await supabase
    .from('bustabit_games')
    .select('id, game_hash, multiplier, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  
  console.log('게임 통계 조회 결과:', gameStats?.length || 0)
  
  // 베팅 통계 조회 - 쿼리 개선 및 로깅 추가
  // 먼저 베팅 데이터만 가져오기
  const { data: rawBetStats, error: betStatsError } = await supabase
    .from('bustabit_bets')
    .select('id, bet_amount, cashout_multiplier, profit, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  
  // 타입 캐스팅으로 베팅 데이터 변환
  const betStats: BetStat[] = rawBetStats as BetStat[] || []
  
  console.log('베팅 통계 조회 결과:', betStats.length)
  if (betStatsError) {
    console.error('베팅 통계 조회 오류:', betStatsError)
  }
  
  // 사용자 정보 가져오기
  if (betStats && betStats.length > 0) {
    // 고유한 사용자 ID 목록 생성
    const userIds = [...new Set(betStats.map(bet => bet.user_id))]
    console.log('고유 사용자 ID 수:', userIds.length)
    
    // 사용자 정보 조회
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', userIds)
    
    console.log('프로필 조회 결과:', profiles?.length || 0)
    if (profilesError) {
      console.error('프로필 조회 오류:', profilesError)
    }
    
    // 사용자 정보를 베팅 데이터에 병합
    if (profiles && profiles.length > 0) {
      const profileMap = new Map(profiles.map(profile => [profile.id, profile]))
      
      for (const bet of betStats) {
        const profile = profileMap.get(bet.user_id)
        if (profile) {
          bet.user = { nickname: profile.nickname }
        }
      }
    }
  }
  
  // 게임 설정 조회
  const { data: gameSettings } = await supabase
    .from('bustabit_settings')
    .select('*')
    .single()
  
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BustabitAdminClient 
        user={user}
        schedulerStatus={schedulerStatus}
        gameStats={gameStats || []}
        betStats={betStats}
        gameSettings={gameSettings || { house_edge: 1, min_bet: 100, max_bet: 10000 }}
      />
    </Suspense>
  )
} 