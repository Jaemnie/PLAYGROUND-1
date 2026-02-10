import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AchievementChecker } from '@/services/achievement-checker'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 모든 업적 정의 조회
  const { data: achievements } = await supabase
    .from('achievements')
    .select('*, reward_title:titles(*)')
    .order('sort_order')

  // 사용자 업적 진행도 조회
  const { data: userAchievements } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', user.id)

  // 업적 진행도 맵 생성
  const progressMap = new Map<string, { progress: number; max_progress: number; unlocked_at: string | null }>()
  for (const ua of (userAchievements || [])) {
    progressMap.set(ua.achievement_id, {
      progress: ua.progress,
      max_progress: ua.max_progress,
      unlocked_at: ua.unlocked_at,
    })
  }

  // 히든 업적 필터링 (해금하지 않은 히든 업적은 제한된 정보만 노출)
  const result = (achievements || []).map((a) => {
    const userProgress = progressMap.get(a.id)
    const isUnlocked = !!userProgress?.unlocked_at

    if (a.is_hidden && !isUnlocked) {
      return {
        id: a.id,
        code: a.code,
        name: '???',
        description: '히든 업적',
        category: a.category,
        icon: 'HelpCircle',
        rarity: a.rarity,
        is_hidden: true,
        progress: 0,
        max_progress: 1,
        unlocked_at: null,
        reward_gems: a.reward_gems,
        reward_title: null,
      }
    }

    return {
      id: a.id,
      code: a.code,
      name: a.name,
      description: a.description,
      category: a.category,
      icon: a.icon,
      rarity: a.rarity,
      is_hidden: a.is_hidden,
      progress: userProgress?.progress || 0,
      max_progress: userProgress?.max_progress || a.condition?.value || 1,
      unlocked_at: userProgress?.unlocked_at || null,
      reward_gems: a.reward_gems,
      reward_title: a.reward_title,
    }
  })

  return NextResponse.json({ achievements: result })
}

// 업적 체크 트리거 (거래 후 호출)
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const checker = new AchievementChecker()
  const unlocks = await checker.checkAchievements(user.id)

  return NextResponse.json({ unlocks })
}
