import { createClient } from '@/lib/supabase/server'
import { LeaderboardClient } from './leaderboard-client'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function LeaderboardPage() {
  const supabase = await createClient()

  // 전체 사용자 랭킹 (수익률 기준 내림차순)
  const { data: allUsers } = await supabase
    .from('profiles')
    .select('*')
    .order('gain_percentage', { ascending: false })

  // 수익률 순위 (상위 10명)
  const { data: performanceRanking } = await supabase
    .from('profiles')
    .select('*')
    .order('gain_percentage', { ascending: false })
    .limit(10)

  // 거래량 순위 (상위 10명, 프로필에 trading_volume 컬럼이 있다고 가정)
  const { data: volumeRanking } = await supabase
    .from('profiles')
    .select('*')
    .order('trading_volume', { ascending: false })
    .limit(10)

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LeaderboardClient
        allUsers={allUsers || []}
        performanceRanking={performanceRanking || []}
        volumeRanking={volumeRanking || []}
      />
    </Suspense>
  )
}
