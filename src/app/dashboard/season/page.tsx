import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SeasonClient } from './season-client'
import { SeasonManager } from '@/services/season-manager'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface Holding {
  user_id: string
  shares: number
  company: { current_price: number } | { current_price: number }[] | null
}

export default async function SeasonPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 현재 활성 시즌
  const { data: season } = await supabase
    .from('seasons')
    .select('*, theme:season_themes(*)')
    .eq('status', 'active')
    .single()

  // 사용자 참가 정보 - 없으면 자동 참여
  let participation = null
  if (season) {
    let { data } = await supabase
      .from('season_participants')
      .select('*')
      .eq('season_id', season.id)
      .eq('user_id', user.id)
      .maybeSingle()
    participation = data

    if (!participation) {
      const manager = new SeasonManager()
      await manager.initialize()
      await manager.joinSeason(user.id, season.id)
      const { data: joined } = await supabase
        .from('season_participants')
        .select('*')
        .eq('season_id', season.id)
        .eq('user_id', user.id)
        .single()
      participation = joined
    }
  }

  // 시즌 랭킹: 실시간 계산 (포인트 + 주식 자산)
  const { data: holdings } = await supabase
    .from('holdings')
    .select('user_id, shares, company:companies(current_price)')

  const userStockValues = new Map<string, number>()
  if (holdings) {
    for (const h of holdings as Holding[]) {
      const company = h.company
      const price = Array.isArray(company) ? company[0]?.current_price : company?.current_price
      const stockValue = (h.shares || 0) * (price || 0)
      userStockValues.set(h.user_id, (userStockValues.get(h.user_id) || 0) + stockValue)
    }
  }

  const { data: allProfiles } = await supabase.from('profiles').select('id, nickname, points')
  const { data: ranks } = await supabase.from('user_ranks').select('user_id, tier, division')

  const rankMap = new Map<string, { tier: string; division: number }>()
  if (ranks) {
    for (const r of ranks) {
      rankMap.set(r.user_id, { tier: r.tier, division: r.division })
    }
  }

  // 실시간 총 자산 기준 시즌 랭킹
  const seasonLeaderboardLive = (allProfiles || []).map(p => {
    const stockValue = userStockValues.get(p.id) || 0
    const totalCapital = (p.points || 0) + stockValue
    const rank = rankMap.get(p.id)
    return {
      user_id: p.id,
      nickname: p.nickname || '이름 없음',
      season_points: totalCapital,
      tier: rank?.tier || 'bronze',
      division: rank?.division || 3,
    }
  }).sort((a, b) => b.season_points - a.season_points)

  // 과거 시즌 기록
  const { data: pastSeasons } = await supabase
    .from('seasons')
    .select('*, theme:season_themes(*)')
    .eq('status', 'ended')
    .order('season_number', { ascending: false })
    .limit(10)

  // 시즌 패스 보상
  let passRewards: { level: number; free_reward: unknown; premium_reward: unknown }[] = []
  if (season) {
    const { data } = await supabase
      .from('season_pass_rewards')
      .select('*')
      .eq('theme_id', season.theme_id)
      .order('level')
    passRewards = data || []
  }

  // 현재 유저 실시간 총 자산 (참여 현황 표시용)
  const myEntry = seasonLeaderboardLive.find((e) => e.user_id === user.id)
  const participationWithLivePoints = participation && myEntry
    ? { ...participation, season_points: myEntry.season_points }
    : participation

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SeasonClient
        season={season}
        participation={participationWithLivePoints}
        seasonLeaderboard={seasonLeaderboardLive}
        pastSeasons={pastSeasons || []}
        passRewards={passRewards}
        userId={user.id}
      />
    </Suspense>
  )
}
