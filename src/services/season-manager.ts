import { createAdminClient } from '@/lib/supabase/admin'
import { SupabaseClient } from '@supabase/supabase-js'

const SEASON_DURATION_DAYS = 28
const THEME_CODES = ['stone_age', 'medieval', 'industrial', 'future']

interface SeasonTheme {
  id: string
  theme_code: string
  name: string
  color: string
}

interface Season {
  id: string
  season_number: number
  theme_id: string
  starts_at: string
  ends_at: string
  status: string
}

/**
 * 시즌 매니저 서비스
 * 시즌 시작/종료/보상 처리, 테마 순환
 */
export class SeasonManager {
  private supabase!: SupabaseClient

  async initialize() {
    this.supabase = createAdminClient()
  }

  private async ensureInitialized() {
    if (!this.supabase) await this.initialize()
  }

  /**
   * 시즌 틱 - 매일 cron에서 호출
   * 현재 시즌 상태를 체크하고 종료/시작 처리
   */
  async tick() {
    await this.ensureInitialized()
    const now = new Date()

    // 현재 활성 시즌 조회
    const { data: activeSeason } = await this.supabase
      .from('seasons')
      .select('*, theme:season_themes(*)')
      .eq('status', 'active')
      .single()

    if (!activeSeason) {
      // 활성 시즌이 없으면 다음 시즌 시작
      await this.startNextSeason()
      return
    }

    // 시즌 종료 시각 도달 확인
    const endsAt = new Date(activeSeason.ends_at)
    if (now >= endsAt) {
      await this.endSeason(activeSeason as Season)
      await this.startNextSeason()
    }
  }

  /**
   * 시즌 종료 처리
   */
  private async endSeason(season: Season) {
    console.log(`[SeasonManager] 시즌 ${season.season_number} 종료 처리 시작`)

    // 1. 참가자 최종 자산 계산 및 순위 결정
    const { data: participants } = await this.supabase
      .from('season_participants')
      .select('*')
      .eq('season_id', season.id)
      .order('season_points', { ascending: false })

    if (participants && participants.length > 0) {
      // 순위 부여
      for (let i = 0; i < participants.length; i++) {
        await this.supabase
          .from('season_participants')
          .update({
            final_rank: i + 1,
            final_total_assets: participants[i].season_points,
          })
          .eq('id', participants[i].id)
      }

      // 2. 보상 지급
      const { data: rewards } = await this.supabase
        .from('season_rewards')
        .select('*')
        .eq('theme_id', season.theme_id)

      if (rewards) {
        for (const participant of participants) {
          const rank = participants.indexOf(participant) + 1

          for (const reward of rewards) {
            if (rank >= reward.rank_from && rank <= reward.rank_to) {
              // 젬 지급
              if (reward.reward_gems > 0) {
                const { data: profile } = await this.supabase
                  .from('profiles')
                  .select('gems')
                  .eq('id', participant.user_id)
                  .single()

                if (profile) {
                  await this.supabase
                    .from('profiles')
                    .update({ gems: (profile.gems || 0) + reward.reward_gems })
                    .eq('id', participant.user_id)
                }
              }

              // 보상 수령 처리
              await this.supabase
                .from('season_participants')
                .update({ reward_claimed: true })
                .eq('id', participant.id)

              break // 해당 순위의 첫 번째 매칭 보상만
            }
          }
        }
      }
    }

    // 3. 시즌 상태 변경
    await this.supabase
      .from('seasons')
      .update({ status: 'ended' })
      .eq('id', season.id)

    console.log(`[SeasonManager] 시즌 ${season.season_number} 종료 완료`)
  }

  /**
   * 다음 시즌 시작
   */
  private async startNextSeason() {
    // 마지막 시즌 번호 조회
    const { data: lastSeason } = await this.supabase
      .from('seasons')
      .select('season_number')
      .order('season_number', { ascending: false })
      .limit(1)
      .single()

    const nextNumber = (lastSeason?.season_number || 0) + 1

    // 테마 순환: season_number % 4
    const themeIndex = (nextNumber - 1) % 4
    const themeCode = THEME_CODES[themeIndex]

    const { data: theme } = await this.supabase
      .from('season_themes')
      .select('*')
      .eq('theme_code', themeCode)
      .single()

    if (!theme) {
      console.error(`[SeasonManager] 테마 ${themeCode} 를 찾을 수 없습니다`)
      return
    }

    // 시작/종료 일시
    const startsAt = new Date()
    const endsAt = new Date(startsAt)
    endsAt.setDate(endsAt.getDate() + SEASON_DURATION_DAYS)

    // 새 시즌 생성
    const { data: newSeason } = await this.supabase
      .from('seasons')
      .insert({
        season_number: nextNumber,
        theme_id: theme.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'active',
      })
      .select()
      .single()

    if (!newSeason) {
      console.error('[SeasonManager] 새 시즌 생성 실패')
      return
    }

    // initial_price로 리셋
    const { data: themeCompanies } = await this.supabase
      .from('companies')
      .select('id, initial_price')
      .eq('theme_id', theme.id)

    if (themeCompanies) {
      for (const company of themeCompanies) {
        await this.supabase
          .from('companies')
          .update({
            current_price: company.initial_price,
            previous_price: company.initial_price,
            last_closing_price: company.initial_price,
            is_delisted: false,
            consecutive_down_days: 0,
          })
          .eq('id', company.id)
      }
    }

    // 뉴스 테이블 초기화 (이전 시즌 뉴스 제거)
    const { error: newsError } = await this.supabase.from('news').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (newsError) {
      console.warn('[SeasonManager] 뉴스 초기화 중 오류 (무시됨):', newsError.message)
    } else {
      console.log('[SeasonManager] 뉴스 테이블 초기화 완료')
    }

    // 시장 이벤트 비활성화
    await this.supabase.from('market_events').update({ is_active: false }).eq('is_active', true)

    console.log(`[SeasonManager] 시즌 ${nextNumber} 시작: ${theme.name} (${startsAt.toISOString()} ~ ${endsAt.toISOString()})`)
  }

  /**
   * 현재 활성 시즌 정보 조회
   */
  async getCurrentSeason(): Promise<(Season & { theme: SeasonTheme }) | null> {
    await this.ensureInitialized()

    const { data } = await this.supabase
      .from('seasons')
      .select('*, theme:season_themes(*)')
      .eq('status', 'active')
      .single()

    return data as (Season & { theme: SeasonTheme }) | null
  }

  /**
   * 시즌 참가 등록
   */
  async joinSeason(userId: string, seasonId: string) {
    await this.ensureInitialized()

    const { data: existing } = await this.supabase
      .from('season_participants')
      .select('id')
      .eq('season_id', seasonId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) return // 이미 참가

    await this.supabase
      .from('season_participants')
      .insert({
        season_id: seasonId,
        user_id: userId,
        season_points: 10000000, // 1,000만P
      })
  }

  /**
   * 시즌 패스 XP 추가
   */
  async addPassXP(userId: string, xp: number) {
    await this.ensureInitialized()

    const season = await this.getCurrentSeason()
    if (!season) return

    const { data: participant } = await this.supabase
      .from('season_participants')
      .select('id, pass_xp, pass_level')
      .eq('season_id', season.id)
      .eq('user_id', userId)
      .single()

    if (!participant) return

    let newXP = participant.pass_xp + xp
    let newLevel = participant.pass_level
    const xpPerLevel = 100

    while (newXP >= xpPerLevel && newLevel < 30) {
      newXP -= xpPerLevel
      newLevel += 1
    }

    await this.supabase
      .from('season_participants')
      .update({ pass_xp: newXP, pass_level: newLevel })
      .eq('id', participant.id)
  }
}
