import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { StatsTracker } from '@/services/stats-tracker'
import { MissionChecker } from '@/services/mission-checker'
import { AchievementChecker } from '@/services/achievement-checker'

/**
 * 뉴스 읽음 처리
 * - user_news_reads에 기록 (동일 뉴스 중복 방지)
 * - 최초 읽음 시: user_stats.news_read 증가, 미션/업적 갱신
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  try {
    const body = await request.json()
    const { news_id: newsId } = body

    if (!newsId || typeof newsId !== 'string') {
      return NextResponse.json({ error: 'news_id 필요' }, { status: 400 })
    }

    // 이미 읽은 뉴스인지 확인
    const { data: existing } = await supabase
      .from('user_news_reads')
      .select('id')
      .eq('user_id', user.id)
      .eq('news_id', newsId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ firstRead: false })
    }

    // 읽음 기록 (unique 제약으로 중복 시 에러)
    const { error: insertError } = await supabase
      .from('user_news_reads')
      .insert({ user_id: user.id, news_id: newsId })

    if (insertError) {
      // unique 제약 위반 = 이미 읽음
      if (insertError.code === '23505') {
        return NextResponse.json({ firstRead: false })
      }
      throw insertError
    }

    // user_stats.news_read 증가
    const statsTracker = new StatsTracker()
    await statsTracker.incrementNewsRead(user.id)

    // 미션 진행도 갱신
    const missionChecker = new MissionChecker()
    const completedMissions = await missionChecker.updateMissionProgress(user.id, 'news_read', 1)

    // 업적 체크
    const achievementChecker = new AchievementChecker()
    const unlocks = await achievementChecker.checkAchievements(user.id)

    return NextResponse.json({
      firstRead: true,
      completed: completedMissions,
      unlocks,
    })
  } catch (error) {
    console.error('[news/read] Error:', error)
    return NextResponse.json({ error: '처리 실패' }, { status: 500 })
  }
}
