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

  // 시즌 리더보드 (상위 20명)
  let seasonLeaderboard: { user_id: string; season_points: number; nickname: string }[] = []
  if (season) {
    const { data: participants } = await supabase
      .from('season_participants')
      .select('user_id, season_points')
      .eq('season_id', season.id)
      .order('season_points', { ascending: false })
      .limit(20)

    if (participants) {
      const userIds = participants.map(p => p.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', userIds)

      const profileMap = new Map<string, string>()
      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, p.nickname || '이름 없음')
        }
      }

      seasonLeaderboard = participants.map(p => ({
        user_id: p.user_id,
        season_points: p.season_points,
        nickname: profileMap.get(p.user_id) || '이름 없음',
      }))
    }
  }

  // 전체 랭킹 (포인트 + 주식 자산)
  const { data: holdings } = await supabase
    .from('holdings')
    .select('user_id, shares, company:companies(current_price)')

  const userStockValues = new Map<string, number>()
  const userIds = new Set<string>()
  if (holdings) {
    for (const h of holdings as Holding[]) {
      const company = h.company
      const price = Array.isArray(company) ? company[0]?.current_price : company?.current_price
      const stockValue = (h.shares || 0) * (price || 0)
      userStockValues.set(h.user_id, (userStockValues.get(h.user_id) || 0) + stockValue)
      userIds.add(h.user_id)
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

  const globalLeaderboard = (allProfiles || []).map(p => {
    const stockValue = userStockValues.get(p.id) || 0
    const totalCapital = (p.points || 0) + stockValue
    const rank = rankMap.get(p.id)
    return {
      id: p.id,
      nickname: p.nickname || '이름 없음',
      points: p.points || 0,
      stock_value: stockValue,
      total_capital: totalCapital,
      tier: rank?.tier || 'bronze',
      division: rank?.division || 3,
    }
  }).sort((a, b) => b.total_capital - a.total_capital)

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

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SeasonClient
        season={season}
        participation={participation}
        seasonLeaderboard={seasonLeaderboard}
        globalLeaderboard={globalLeaderboard}
        pastSeasons={pastSeasons || []}
        passRewards={passRewards}
        userId={user.id}
      />
    </Suspense>
  )
}
