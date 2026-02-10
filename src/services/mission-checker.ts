import { createAdminClient } from '@/lib/supabase/admin'
import { SupabaseClient } from '@supabase/supabase-js'

interface MissionTemplate {
  id: string
  code: string
  name: string
  category: string
  condition: { type: string; value: number }
  reward_gems: number
  reward_rp: number
  weight: number
}

interface UserMission {
  id: string
  mission_template_id: string
  progress: number
  max_progress: number
  is_completed: boolean
  reward_claimed: boolean
}

/**
 * 미션 체커 서비스
 */
export class MissionChecker {
  private supabase!: SupabaseClient

  async initialize() {
    this.supabase = createAdminClient()
  }

  private async ensureInitialized() {
    if (!this.supabase) await this.initialize()
  }

  /**
   * 일일 미션 배정 (모든 유저에게)
   */
  async assignDailyMissions() {
    await this.ensureInitialized()

    // 일일 미션 템플릿 로드
    const { data: templates } = await this.supabase
      .from('mission_templates')
      .select('*')
      .eq('category', 'daily')

    if (!templates || templates.length === 0) return

    // 모든 유저 조회
    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('id')

    if (!profiles) return

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    for (const profile of profiles) {
      // 오늘 이미 배정된 일일 미션이 있는지 확인
      const { count } = await this.supabase
        .from('user_missions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .gte('assigned_at', today.toISOString().split('T')[0])
        .eq('reward_claimed', false)

      if ((count || 0) >= 3) continue // 이미 3개 배정됨

      // 가중치 기반 랜덤 선택 (3개)
      const selected = this.weightedRandomSelect(templates as MissionTemplate[], 3)

      for (const template of selected) {
        await this.supabase
          .from('user_missions')
          .insert({
            user_id: profile.id,
            mission_template_id: template.id,
            progress: 0,
            max_progress: template.condition.value,
            is_completed: false,
            reward_claimed: false,
            assigned_at: new Date().toISOString(),
            expires_at: tomorrow.toISOString(),
          })
      }
    }
  }

  /**
   * 주간 미션 배정
   */
  async assignWeeklyMissions() {
    await this.ensureInitialized()

    const { data: templates } = await this.supabase
      .from('mission_templates')
      .select('*')
      .eq('category', 'weekly')

    if (!templates || templates.length === 0) return

    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('id')

    if (!profiles) return

    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)

    for (const profile of profiles) {
      const selected = this.weightedRandomSelect(templates as MissionTemplate[], 2)

      for (const template of selected) {
        await this.supabase
          .from('user_missions')
          .insert({
            user_id: profile.id,
            mission_template_id: template.id,
            progress: 0,
            max_progress: template.condition.value,
            is_completed: false,
            reward_claimed: false,
            assigned_at: new Date().toISOString(),
            expires_at: nextWeek.toISOString(),
          })
      }
    }
  }

  /**
   * 미션 진행도 갱신 (거래 후 호출)
   */
  async updateMissionProgress(userId: string, eventType: string, value: number = 1) {
    await this.ensureInitialized()

    // 활성 미션 조회
    const { data: missions } = await this.supabase
      .from('user_missions')
      .select('*, mission_template:mission_templates(*)')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .gt('expires_at', new Date().toISOString())

    if (!missions) return

    for (const mission of missions) {
      const template = mission.mission_template as MissionTemplate
      if (!template) continue

      const condType = template.condition.type

      // 이벤트 타입 매칭
      const matches = this.doesEventMatch(condType, eventType)
      if (!matches) continue

      const newProgress = Math.min(mission.progress + value, mission.max_progress)
      const isCompleted = newProgress >= mission.max_progress

      await this.supabase
        .from('user_missions')
        .update({
          progress: newProgress,
          is_completed: isCompleted,
        })
        .eq('id', mission.id)
    }
  }

  /**
   * 미션 보상 수령
   */
  async claimReward(userId: string, missionId: string): Promise<{ gems: number; rp: number } | null> {
    await this.ensureInitialized()

    const { data: mission } = await this.supabase
      .from('user_missions')
      .select('*, mission_template:mission_templates(*)')
      .eq('id', missionId)
      .eq('user_id', userId)
      .eq('is_completed', true)
      .eq('reward_claimed', false)
      .single()

    if (!mission) return null

    const template = mission.mission_template as MissionTemplate

    // 보상 지급
    if (template.reward_gems > 0) {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('gems')
        .eq('id', userId)
        .single()

      if (profile) {
        await this.supabase
          .from('profiles')
          .update({ gems: (profile.gems || 0) + template.reward_gems })
          .eq('id', userId)
      }
    }

    // 보상 수령 처리
    await this.supabase
      .from('user_missions')
      .update({ reward_claimed: true })
      .eq('id', missionId)

    return { gems: template.reward_gems, rp: template.reward_rp }
  }

  /**
   * 출석 체크
   */
  async checkIn(userId: string): Promise<{ streak: number; gems: number; alreadyCheckedIn: boolean }> {
    await this.ensureInitialized()

    const today = new Date().toISOString().split('T')[0]

    // 이미 출석했는지 확인
    const { data: existing } = await this.supabase
      .from('daily_check_ins')
      .select('*')
      .eq('user_id', userId)
      .eq('checked_in_at', today)
      .maybeSingle()

    if (existing) {
      return { streak: existing.streak, gems: 0, alreadyCheckedIn: true }
    }

    // 어제 출석 확인 (스트릭)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: yesterdayCheckIn } = await this.supabase
      .from('daily_check_ins')
      .select('streak')
      .eq('user_id', userId)
      .eq('checked_in_at', yesterdayStr)
      .maybeSingle()

    const streak = (yesterdayCheckIn?.streak || 0) + 1
    const dayInWeek = ((streak - 1) % 7) + 1

    // 출석 보상 계산
    const rewardMap: Record<number, number> = { 1: 5, 2: 5, 3: 10, 4: 10, 5: 15, 6: 15, 7: 30 }
    const gems = rewardMap[dayInWeek] || 5

    // 출석 기록
    await this.supabase
      .from('daily_check_ins')
      .insert({
        user_id: userId,
        checked_in_at: today,
        streak,
        reward_gems: gems,
      })

    // 젬 지급
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('gems')
      .eq('id', userId)
      .single()

    if (profile) {
      await this.supabase
        .from('profiles')
        .update({ gems: (profile.gems || 0) + gems })
        .eq('id', userId)
    }

    return { streak, gems, alreadyCheckedIn: false }
  }

  private doesEventMatch(condType: string, eventType: string): boolean {
    const mapping: Record<string, string[]> = {
      daily_trade_count: ['trade'],
      daily_buy_count: ['buy'],
      daily_profit_count: ['profit_sell'],
      daily_new_stock: ['buy'],
      daily_news_read: ['news_read'],
      daily_message: ['message_sent'],
      weekly_trade_count: ['trade'],
      weekly_sectors: ['trade'],
      weekly_volume: ['trade'],
      weekly_profit_count: ['profit_sell'],
    }
    return (mapping[condType] || []).includes(eventType)
  }

  private weightedRandomSelect<T extends { weight: number }>(items: T[], count: number): T[] {
    const result: T[] = []
    const available = [...items]

    for (let i = 0; i < count && available.length > 0; i++) {
      const totalWeight = available.reduce((sum, item) => sum + item.weight, 0)
      let random = Math.random() * totalWeight
      let selectedIdx = 0

      for (let j = 0; j < available.length; j++) {
        random -= available[j].weight
        if (random <= 0) {
          selectedIdx = j
          break
        }
      }

      result.push(available[selectedIdx])
      available.splice(selectedIdx, 1)
    }

    return result
  }
}
