import { createAdminClient } from '@/lib/supabase/admin'
import { SupabaseClient } from '@supabase/supabase-js'

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster'] as const
type Tier = typeof TIER_ORDER[number]

const TIER_THRESHOLDS: Record<string, number> = {
  bronze: 0,
  silver: 100,
  gold: 200,
  platinum: 300,
  diamond: 400,
  master: 500,
  grandmaster: 600,
}

interface RankData {
  tier: Tier
  division: number
  rank_points: number
  peak_tier: Tier
  peak_division: number
  demotion_shield: number
}

/**
 * 랭크 엔진 서비스
 * RP 계산, 승급/강등 처리
 */
export class RankEngine {
  private supabase!: SupabaseClient

  async initialize() {
    this.supabase = createAdminClient()
  }

  private async ensureInitialized() {
    if (!this.supabase) await this.initialize()
  }

  /**
   * 거래 후 RP 갱신
   * @param profitRate - 수익률 (-100 ~ +∞%)
   */
  async updateRPAfterTrade(userId: string, profitRate: number, isProfit: boolean): Promise<{
    rpChange: number
    promoted: boolean
    demoted: boolean
    newTier?: string
    newDivision?: number
  }> {
    await this.ensureInitialized()

    const { data: rank } = await this.supabase
      .from('user_ranks')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!rank) return { rpChange: 0, promoted: false, demoted: false }

    let rpChange: number

    if (isProfit) {
      // 수익 매도: +10 ~ +50 RP (수익률 비례)
      rpChange = Math.min(50, Math.max(10, Math.round(profitRate * 5)))
    } else {
      // 손실 매도: -5 ~ -30 RP (손실률 비례)
      rpChange = -Math.min(30, Math.max(5, Math.round(Math.abs(profitRate) * 3)))
    }

    const newRP = rank.rank_points + rpChange
    const result = this.processRankChange(rank as RankData, newRP)

    await this.supabase
      .from('user_ranks')
      .update({
        tier: result.tier,
        division: result.division,
        rank_points: result.rank_points,
        peak_tier: result.peak_tier,
        peak_division: result.peak_division,
        demotion_shield: result.demotion_shield,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return {
      rpChange,
      promoted: result.promoted,
      demoted: result.demoted,
      newTier: result.tier,
      newDivision: result.division,
    }
  }

  /**
   * 업적/미션 달성 시 RP 보너스
   */
  async addBonusRP(userId: string, amount: number) {
    await this.ensureInitialized()

    const { data: rank } = await this.supabase
      .from('user_ranks')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!rank) return

    const newRP = rank.rank_points + amount
    const result = this.processRankChange(rank as RankData, newRP)

    await this.supabase
      .from('user_ranks')
      .update({
        tier: result.tier,
        division: result.division,
        rank_points: result.rank_points,
        peak_tier: result.peak_tier,
        peak_division: result.peak_division,
        demotion_shield: result.demotion_shield,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }

  /**
   * 랭크 변경 처리 (승급/강등 로직)
   */
  private processRankChange(current: RankData, newRP: number): RankData & { promoted: boolean; demoted: boolean } {
    let tier = current.tier
    let division = current.division
    let rp = newRP
    let shield = current.demotion_shield
    let promoted = false
    let demoted = false

    // 승급 처리: RP >= 100
    while (rp >= 100) {
      rp -= 100

      if (tier === 'master' || tier === 'grandmaster') {
        // 마스터/그마는 디비전 없음, RP 축적
        rp += 100 // 돌려놓기
        break
      }

      if (division > 1) {
        // 디비전 승급 (III → II → I)
        division -= 1
        shield = 3 // 승급 보호
        promoted = true
      } else {
        // 티어 승급
        const tierIdx = TIER_ORDER.indexOf(tier)
        if (tierIdx < TIER_ORDER.length - 1) {
          tier = TIER_ORDER[tierIdx + 1]
          division = 3
          shield = 3
          promoted = true
        }
      }
    }

    // 강등 처리: RP < 0
    while (rp < 0) {
      if (tier === 'bronze' && division === 3) {
        rp = 0 // 최하위 고정
        break
      }

      if (shield > 0) {
        shield -= 1
        rp = 0 // 강등 보호 발동
        break
      }

      rp += 100 // 이전 단계의 RP로 전환

      if (tier === 'master' || tier === 'grandmaster') {
        const tierIdx = TIER_ORDER.indexOf(tier)
        tier = TIER_ORDER[tierIdx - 1]
        division = 1
        demoted = true
      } else if (division < 3) {
        division += 1
        demoted = true
      } else {
        const tierIdx = TIER_ORDER.indexOf(tier)
        if (tierIdx > 0) {
          tier = TIER_ORDER[tierIdx - 1]
          division = 1
          demoted = true
        }
      }
    }

    // 최고 티어 갱신
    let peakTier = current.peak_tier
    let peakDivision = current.peak_division
    const currentScore = TIER_ORDER.indexOf(tier) * 10 + (4 - division)
    const peakScore = TIER_ORDER.indexOf(peakTier as Tier) * 10 + (4 - peakDivision)

    if (currentScore > peakScore) {
      peakTier = tier
      peakDivision = division
    }

    return {
      tier,
      division,
      rank_points: rp,
      peak_tier: peakTier as Tier,
      peak_division: peakDivision,
      demotion_shield: shield,
      promoted,
      demoted,
    }
  }
}
