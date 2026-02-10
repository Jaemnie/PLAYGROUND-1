import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SeasonClient } from './season-client'

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

  // 사용자 참가 정보
  let participation = null
  if (season) {
    const { data } = await supabase
      .from('season_participants')
      .select('*')
      .eq('season_id', season.id)
      .eq('user_id', user.id)
      .maybeSingle()
    participation = data
  }

  // 시즌 리더보드 (상위 20명)
  let leaderboard: { user_id: string; season_points: number; nickname: string }[] = []
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

      leaderboard = participants.map(p => ({
        user_id: p.user_id,
        season_points: p.season_points,
        nickname: profileMap.get(p.user_id) || '이름 없음',
      }))
    }
  }

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
    <SeasonClient
      season={season}
      participation={participation}
      leaderboard={leaderboard}
      pastSeasons={pastSeasons || []}
      passRewards={passRewards}
      userId={user.id}
    />
  )
}
