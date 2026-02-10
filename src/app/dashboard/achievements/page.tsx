import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AchievementsClient } from './achievements-client'

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 업적 정의 + 칭호
  const { data: achievements } = await supabase
    .from('achievements')
    .select('*, reward_title:titles(*)')
    .order('sort_order')

  // 사용자 업적 진행도
  const { data: userAchievements } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', user.id)

  // 프로필 (장착 칭호)
  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, equipped_title_id')
    .eq('id', user.id)
    .single()

  // 진행도 맵
  const progressMap = new Map()
  for (const ua of (userAchievements || [])) {
    progressMap.set(ua.achievement_id, ua)
  }

  // 합치기
  const merged = (achievements || []).map((a) => {
    const ua = progressMap.get(a.id)
    const isUnlocked = !!ua?.unlocked_at

    return {
      id: a.id,
      code: a.code,
      name: a.is_hidden && !isUnlocked ? '???' : a.name,
      description: a.is_hidden && !isUnlocked ? '히든 업적입니다' : a.description,
      category: a.category,
      icon: a.is_hidden && !isUnlocked ? 'HelpCircle' : a.icon,
      rarity: a.rarity,
      is_hidden: a.is_hidden,
      progress: ua?.progress || 0,
      max_progress: ua?.max_progress || a.condition?.value || 1,
      unlocked_at: ua?.unlocked_at || null,
      reward_gems: a.reward_gems,
      reward_title: a.reward_title,
    }
  })

  return (
    <AchievementsClient
      achievements={merged}
      gems={profile?.gems || 0}
    />
  )
}
