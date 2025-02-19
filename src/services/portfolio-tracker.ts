import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

interface PortfolioSnapshot {
  user_id: string;
  holdings_value: number;
  realized_gains: number;
  cash_balance: number;
  total_investment: number;
  total_return_rate: number;
}

export class PortfolioTracker {
  private supabase!: SupabaseClient;

  async initialize() {
    this.supabase = await createClient();
  }

  async recordPerformance(userId: string) {
    if (!this.supabase) await this.initialize();
    try {
      // 1. 현재 보유 주식 정보 조회
      const { data: holdings } = await this.supabase
        .from('holdings')
        .select(`
          *,
          company:companies(current_price),
          unrealized_gain,
          total_realized_gain,
          first_purchase_date
        `)
        .eq('user_id', userId)

      if (!holdings) return;

      // 2. 현재 현금 잔액 조회
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('cash_balance')
        .eq('id', userId)
        .single()

      // 3. 포트폴리오 스냅샷 생성
      const snapshot: PortfolioSnapshot = {
        user_id: userId,
        holdings_value: holdings.reduce((sum, h) => 
          sum + (h.shares * h.company.current_price), 0),
        realized_gains: holdings.reduce((sum, h) => 
          sum + (h.total_realized_gain || 0), 0),
        cash_balance: profile?.cash_balance || 0,
        total_investment: holdings.reduce((sum, h) => 
          sum + (h.shares * h.average_cost), 0),
        total_return_rate: 0 // 아래에서 계산
      }

      // 4. 전체 수익률 계산
      const totalValue = snapshot.holdings_value + snapshot.realized_gains + snapshot.cash_balance
      snapshot.total_return_rate = snapshot.total_investment > 0
        ? ((totalValue - snapshot.total_investment) / snapshot.total_investment) * 100
        : 0

      // 5. 스냅샷 저장
      await this.supabase
        .from('portfolio_snapshots')
        .insert(snapshot)

    } catch (error) {
      console.error('포트폴리오 성과 기록 중 오류:', error)
    }
  }
}
