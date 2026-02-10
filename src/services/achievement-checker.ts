import { createAdminClient } from '@/lib/supabase/admin'
import { SupabaseClient } from '@supabase/supabase-js'

interface Achievement {
  id: string
  code: string
  name: string
  description: string
  category: string
  rarity: string
  condition: AchievementCondition
  reward_gems: number
  reward_title_id: string | null
  is_hidden: boolean
}

interface AchievementCondition {
  type: string
  value: number
  field?: string
}

interface UserStats {
  total_trades: number
  total_buy_trades: number
  total_sell_trades: number
  total_profit_trades: number
  total_loss_trades: number
  profit_streak: number
  max_profit_streak: number
  max_single_profit: number
  max_single_loss: number
  max_portfolio_value: number
  total_volume: number
  unique_stocks_traded: number
  unique_sectors_traded: number
  login_streak: number
  max_login_streak: number
  messages_sent: number
  friends_count: number
  news_read: number
}

interface UserAchievement {
  id: string
  achievement_id: string
  progress: number
  max_progress: number
  unlocked_at: string | null
}

export interface AchievementUnlock {
  achievementId: string
  achievementName: string
  achievementCode: string
  rarity: string
  rewardGems: number
  rewardTitleId: string | null
}

/**
 * 업적 체커 서비스
 * 거래 완료, 포트폴리오 스냅샷, 로그인 시 호출되어
 * 사용자의 업적 진행도를 갱신하고 해금 조건을 평가한다.
 */
export class AchievementChecker {
  private supabase!: SupabaseClient
  private achievementsCache: Achievement[] | null = null

  async initialize() {
    this.supabase = createAdminClient()
  }

  private async ensureInitialized() {
    if (!this.supabase) await this.initialize()
  }

  /**
   * 업적 정의 캐시 로드
   */
  private async loadAchievements(): Promise<Achievement[]> {
    if (this.achievementsCache) return this.achievementsCache

    await this.ensureInitialized()

    const { data } = await this.supabase
      .from('achievements')
      .select('*')
      .order('sort_order')

    this.achievementsCache = (data || []) as Achievement[]
    return this.achievementsCache
  }

  /**
   * 사용자의 모든 업적을 체크하고 진행도를 갱신한다.
   * 새로 해금된 업적 목록을 반환한다.
   */
  async checkAchievements(userId: string, context?: {
    tradeType?: 'buy' | 'sell'
    tradeAmount?: number
    tradePrice?: number
    companyId?: string
    holdings?: { shares: number; company_id: string; average_cost: number }[]
    totalAssets?: number
    profitRate?: number
  }): Promise<AchievementUnlock[]> {
    await this.ensureInitialized()

    const achievements = await this.loadAchievements()
    const stats = await this.getUserStats(userId)
    if (!stats) return []

    // 사용자의 기존 업적 진행도 로드
    const { data: existingAchievements } = await this.supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)

    const existingMap = new Map<string, UserAchievement>()
    for (const ua of (existingAchievements || [])) {
      existingMap.set(ua.achievement_id, ua as UserAchievement)
    }

    const newUnlocks: AchievementUnlock[] = []

    for (const achievement of achievements) {
      const existing = existingMap.get(achievement.id)

      // 이미 해금됨 → 스킵
      if (existing?.unlocked_at) continue

      // 진행도 계산
      const { progress, maxProgress } = this.evaluateCondition(
        achievement.condition,
        stats,
        context
      )

      const isUnlocked = progress >= maxProgress

      if (existing) {
        // 기존 진행도 업데이트
        const updateData: Record<string, unknown> = {
          progress: Math.min(progress, maxProgress),
        }

        if (isUnlocked && !existing.unlocked_at) {
          updateData.unlocked_at = new Date().toISOString()
        }

        await this.supabase
          .from('user_achievements')
          .update(updateData)
          .eq('id', existing.id)
      } else {
        // 새 진행도 생성
        await this.supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
            progress: Math.min(progress, maxProgress),
            max_progress: maxProgress,
            unlocked_at: isUnlocked ? new Date().toISOString() : null,
          })
      }

      // 새로 해금 시 보상 지급
      if (isUnlocked && !existing?.unlocked_at) {
        await this.grantReward(userId, achievement)

        newUnlocks.push({
          achievementId: achievement.id,
          achievementName: achievement.name,
          achievementCode: achievement.code,
          rarity: achievement.rarity,
          rewardGems: achievement.reward_gems,
          rewardTitleId: achievement.reward_title_id,
        })
      }
    }

    return newUnlocks
  }

  /**
   * 업적 조건 평가 - 현재 진행도와 목표 계산
   */
  private evaluateCondition(
    condition: AchievementCondition,
    stats: UserStats,
    context?: Record<string, unknown>
  ): { progress: number; maxProgress: number } {
    const maxProgress = condition.value

    switch (condition.type) {
      // === 트레이딩 ===
      case 'trade_count':
        return { progress: stats.total_trades, maxProgress }
      case 'buy_count':
        return { progress: stats.total_buy_trades, maxProgress }
      case 'sell_count':
        return { progress: stats.total_sell_trades, maxProgress }
      case 'profit_trade_count':
        return { progress: stats.total_profit_trades, maxProgress }
      case 'profit_streak':
        return { progress: stats.max_profit_streak, maxProgress }
      case 'single_trade_amount':
        return {
          progress: (context?.tradeAmount as number) || 0 >= maxProgress ? maxProgress : 0,
          maxProgress,
        }
      case 'total_volume':
        return { progress: Math.min(Number(stats.total_volume), maxProgress), maxProgress }
      case 'all_in': {
        // 전 재산의 90% 이상을 한 종목에 투자했는지
        const totalAssets = (context?.totalAssets as number) || 0
        const tradeAmount = (context?.tradeAmount as number) || 0
        return {
          progress: totalAssets > 0 && tradeAmount / totalAssets >= 0.9 ? 1 : 0,
          maxProgress: 1,
        }
      }

      // === 포트폴리오 ===
      case 'unique_sectors':
        return { progress: stats.unique_sectors_traded, maxProgress }
      case 'total_assets':
        return {
          progress: Math.min(Number(stats.max_portfolio_value), maxProgress),
          maxProgress,
        }
      case 'portfolio_value':
        return {
          progress: Math.min(Number(stats.max_portfolio_value), maxProgress),
          maxProgress,
        }

      // === 소셜 ===
      case 'friends_count':
        return { progress: stats.friends_count, maxProgress }
      case 'messages_sent':
        return { progress: stats.messages_sent, maxProgress }

      // === 탐험 ===
      case 'unique_stocks':
        return { progress: stats.unique_stocks_traded, maxProgress }
      case 'news_read':
        return { progress: stats.news_read, maxProgress }

      // === 로그인 ===
      case 'login_streak':
        return { progress: stats.max_login_streak, maxProgress }

      // === 시장 ===
      case 'leaderboard_rank': {
        // 리더보드 1위 달성 (외부에서 체크)
        const rank = (context?.leaderboardRank as number) || 999
        return { progress: rank <= maxProgress ? 1 : 0, maxProgress: 1 }
      }

      default:
        return { progress: 0, maxProgress }
    }
  }

  /**
   * 업적 달성 보상 지급
   */
  private async grantReward(userId: string, achievement: Achievement) {
    // 젬 보상
    if (achievement.reward_gems > 0) {
      await this.supabase.rpc('increment_points', {
        user_id_input: userId,
        amount_input: achievement.reward_gems,
      })

      // gems 컬럼에 별도로도 추가
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('gems')
        .eq('id', userId)
        .single()

      if (profile) {
        await this.supabase
          .from('profiles')
          .update({ gems: (profile.gems || 0) + achievement.reward_gems })
          .eq('id', userId)
      }
    }

    console.log(
      `[AchievementChecker] 업적 해금: ${achievement.name} (user: ${userId}, gems: ${achievement.reward_gems})`
    )
  }

  /**
   * 사용자 통계 조회
   */
  private async getUserStats(userId: string): Promise<UserStats | null> {
    const { data } = await this.supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single()

    return data as UserStats | null
  }

  /**
   * 캐시 초기화 (업적이 추가/수정된 경우)
   */
  clearCache() {
    this.achievementsCache = null
  }
}
