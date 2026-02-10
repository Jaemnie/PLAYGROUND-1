import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from './components/ProfileClient'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function ProfilePage() {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    // 병렬 데이터 페칭
    const [
      { data: profile },
      { data: userRank },
      { data: userStats },
      { data: allAchievements },
      { data: userAchievements },
      { data: allTitles },
      { data: shopItems },
      { data: userMissions },
      { data: checkIn },
      { data: season },
      { data: seasonParticipation },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('user_ranks').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('achievements').select('*').order('sort_order'),
      supabase.from('user_achievements').select('*').eq('user_id', user.id),
      supabase.from('titles').select('*'),
      supabase.from('shop_items').select('code, category, preview_data'),
      supabase
        .from('user_missions')
        .select('*, template:mission_templates(*)')
        .eq('user_id', user.id)
        .eq('is_completed', false),
      supabase
        .from('daily_check_ins')
        .select('*')
        .eq('user_id', user.id)
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('seasons')
        .select('*, theme:season_themes(*)')
        .eq('status', 'active')
        .single(),
      supabase
        .from('season_participants')
        .select('*')
        .eq('user_id', user.id)
        .limit(10),
    ])

    // 장착 칭호 조회
    const titleMap = new Map((allTitles || []).map((t) => [t.id, t]))
    const equippedTitleObj = profile?.equipped_title_id
      ? titleMap.get(profile.equipped_title_id)
      : null

    // 시즌 참가 정보 (현재 시즌 기준)
    const participation = season
      ? (seasonParticipation || []).find((p) => p.season_id === season.id)
      : null

    // 업적 병합 (achievements + user_achievements)
    const uaMap = new Map((userAchievements || []).map((ua) => [ua.achievement_id, ua]))
    const achievements = (allAchievements || []).map((a) => {
      const ua = uaMap.get(a.id)
      const isUnlocked = !!ua?.unlocked_at
      return {
        id: a.id,
        code: a.code,
        name: a.is_hidden && !isUnlocked ? '???' : a.name,
        description: a.is_hidden && !isUnlocked ? '???' : a.description,
        category: a.category,
        icon: a.is_hidden && !isUnlocked ? 'HelpCircle' : a.icon,
        rarity: a.rarity,
        progress: ua?.progress ?? 0,
        max_progress: ua?.max_progress ?? (a.condition as { value?: number })?.value ?? 1,
        unlocked_at: ua?.unlocked_at ?? null,
      }
    })

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ProfileClient
          user={user}
          profile={profile}
          userRank={userRank}
          userStats={userStats}
          achievements={achievements}
          equippedTitle={equippedTitleObj}
          shopItems={shopItems || []}
          missions={userMissions || []}
          checkIn={checkIn}
          season={season}
          participation={participation}
        />
      </Suspense>
    )
  } catch (error) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
}
