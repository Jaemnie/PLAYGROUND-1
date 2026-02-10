import { createAdminClient } from '@/lib/supabase/admin'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * 사용자 통계 추적 서비스
 * DB 트리거로 기본 거래 통계는 자동 갱신되며,
 * 이 서비스는 포트폴리오 가치, 로그인 스트릭 등 복잡한 통계를 처리한다.
 */
export class StatsTracker {
  private supabase!: SupabaseClient

  async initialize() {
    this.supabase = createAdminClient()
  }

  private async ensureInitialized() {
    if (!this.supabase) await this.initialize()
  }

  /**
   * 포트폴리오 최고 가치 갱신 (시장 업데이트 후 호출)
   */
  async updateMaxPortfolioValue(userId: string, currentValue: number) {
    await this.ensureInitialized()

    await this.supabase
      .from('user_stats')
      .update({
        max_portfolio_value: currentValue,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .lt('max_portfolio_value', currentValue)
  }

  /**
   * 로그인 스트릭 갱신
   */
  async updateLoginStreak(userId: string) {
    await this.ensureInitialized()

    const { data: stats } = await this.supabase
      .from('user_stats')
      .select('login_streak, max_login_streak, updated_at')
      .eq('user_id', userId)
      .single()

    if (!stats) return

    const lastUpdate = new Date(stats.updated_at)
    const now = new Date()
    const diffHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60)

    let newStreak = stats.login_streak

    if (diffHours >= 24 && diffHours < 48) {
      // 어제 로그인 → 스트릭 유지
      newStreak = stats.login_streak + 1
    } else if (diffHours >= 48) {
      // 이틀 이상 미접속 → 스트릭 리셋
      newStreak = 1
    }
    // diffHours < 24 → 같은 날 재접속, 변경 없음

    const maxStreak = Math.max(newStreak, stats.max_login_streak)

    await this.supabase
      .from('user_stats')
      .update({
        login_streak: newStreak,
        max_login_streak: maxStreak,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
  }

  /**
   * 메시지 발송 수 증가
   */
  async incrementMessagesSent(userId: string) {
    await this.ensureInitialized()

    await this.supabase.rpc('increment_user_stat', {
      p_user_id: userId,
      p_field: 'messages_sent'
    })
  }

  /**
   * 친구 수 갱신
   */
  async updateFriendsCount(userId: string) {
    await this.ensureInitialized()

    const { count } = await this.supabase
      .from('friends')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted')

    await this.supabase
      .from('user_stats')
      .update({
        friends_count: count || 0,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
  }

  /**
   * 뉴스 조회 수 증가
   */
  async incrementNewsRead(userId: string) {
    await this.ensureInitialized()

    await this.supabase
      .from('user_stats')
      .update({
        news_read: this.supabase.rpc ? undefined : 0, // fallback
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    // 직접 increment
    await this.supabase.rpc('increment_user_stat', {
      p_user_id: userId,
      p_field: 'news_read'
    })
  }

  /**
   * 전체 사용자의 포트폴리오 최고 가치 일괄 갱신
   */
  async updateAllMaxPortfolioValues() {
    await this.ensureInitialized()

    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('id, points')

    if (!profiles) return

    for (const profile of profiles) {
      const { data: holdings } = await this.supabase
        .from('holdings')
        .select('shares, company_id, companies(current_price)')
        .eq('user_id', profile.id)
        .gt('shares', 0)

      if (!holdings) continue

      let stockValue = 0
      for (const h of holdings) {
        const company = h.companies as unknown as { current_price: number }
        if (company) {
          stockValue += h.shares * company.current_price
        }
      }

      const totalValue = Number(profile.points) + stockValue
      await this.updateMaxPortfolioValue(profile.id, totalValue)
    }
  }
}
