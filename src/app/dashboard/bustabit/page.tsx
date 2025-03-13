import { createClient } from '@/lib/supabase/server'
import { BustabitClient } from './bustabit-client'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function BustabitPage() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }

    // 프로필 정보 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (!profile) {
      return <div>프로필 정보를 찾을 수 없습니다.</div>
    }
    
    // Bustabit 게임 통계 조회
    const { data: bustabitStats } = await supabase
      .from('bustabit_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    // 최근 게임 기록 조회
    const { data: recentGames } = await supabase
      .from('bustabit_games')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    // 사용자의 최근 베팅 기록 조회
    const { data: userBets } = await supabase
      .from('bustabit_bets')
      .select(`
        id,
        bet_amount,
        cashout_multiplier,
        auto_cashout_multiplier,
        profit,
        created_at,
        game:bustabit_games(
          id,
          multiplier,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    // 게임 설정 조회
    const { data: gameSettings } = await supabase
      .from('bustabit_settings')
      .select('*')
      .single()
    
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <BustabitClient 
          user={user}
          profile={profile}
          bustabitStats={bustabitStats || null}
          recentGames={recentGames || []}
          userBets={userBets || []}
          gameSettings={gameSettings || {
            house_edge: 1.00,
            min_bet: 10,
            max_bet: 100000
          }}
        />
      </Suspense>
    )
  } catch (error) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
} 