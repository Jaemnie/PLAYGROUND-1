import { createAdminClient } from '@/lib/supabase/admin'
import { SupabaseClient } from '@supabase/supabase-js'

export class PortfolioTracker {
  private supabase!: SupabaseClient;

  async initialize() {
    this.supabase = createAdminClient();
  }

  async recordPerformance(userId: string) {
    if (!this.supabase) await this.initialize();
    try {
      // 1. 현재 보유 주식 정보 조회
      const { data: holdings } = await this.supabase
        .from('holdings')
        .select(`
          *,
          company:companies(current_price)
        `)
        .eq('user_id', userId)

      if (!holdings) return;

      // 2. 포트폴리오 가치 계산
      const totalValue = holdings.reduce((sum, holding) => 
        sum + (holding.shares * holding.company.current_price), 0)
        
      const totalCost = holdings.reduce((sum, holding) => 
        sum + (holding.shares * holding.average_cost), 0)
        
      const totalProfit = totalValue - totalCost
      const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

      // 3. 성과 기록
      await this.supabase.from('portfolio_performance').insert({
        user_id: userId,
        total_value: totalValue,
        total_profit: totalProfit,
        profit_rate: profitRate
      })

    } catch (error) {
      console.error('포트폴리오 성과 기록 중 오류:', error)
    }
  }
}
