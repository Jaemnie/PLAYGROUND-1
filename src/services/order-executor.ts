import { createAdminClient } from '@/lib/supabase/admin'
import { SupabaseClient } from '@supabase/supabase-js'

interface PendingOrder {
  id: string
  user_id: string
  company_id: string
  order_type: 'buy' | 'sell'
  condition_type: 'price_above' | 'price_below' | 'profit_rate'
  target_value: number
  shares: number
  escrowed_amount: number
  status: string
  expires_at: string
}

interface CompanyPrice {
  id: string
  current_price: number
}

interface Holding {
  user_id: string
  company_id: string
  shares: number
  average_cost: number
}

export class OrderExecutor {
  private supabase!: SupabaseClient

  async initialize() {
    this.supabase = createAdminClient()
  }

  /**
   * 가격 업데이트 후 조건 주문 체결 처리
   * MarketScheduler.updateMarket() 에서 호출됨
   */
  async processOrders(companies: CompanyPrice[]) {
    if (!this.supabase) await this.initialize()

    try {
      // 1. 활성 pending 주문 조회
      const { data: pendingOrders, error } = await this.supabase
        .from('pending_orders')
        .select('*')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())

      if (error || !pendingOrders || pendingOrders.length === 0) return

      // 회사 가격 맵 생성
      const priceMap = new Map<string, number>()
      for (const c of companies) {
        priceMap.set(c.id, c.current_price)
      }

      // 2. 각 주문별 조건 확인 및 체결
      for (const order of pendingOrders as PendingOrder[]) {
        const currentPrice = priceMap.get(order.company_id)
        if (currentPrice === undefined) continue

        const shouldExecute = await this.checkCondition(order, currentPrice)

        if (shouldExecute) {
          await this.executeOrder(order, currentPrice)
        }
      }

      // 3. 만료된 주문 처리
      await this.expireOrders()

    } catch (error) {
      console.error('[OrderExecutor] 조건 주문 처리 중 오류:', error)
    }
  }

  /**
   * 조건 충족 여부 확인
   */
  private async checkCondition(order: PendingOrder, currentPrice: number): Promise<boolean> {
    switch (order.condition_type) {
      case 'price_below':
        // 가격이 목표가 이하로 떨어지면 매수
        return currentPrice <= order.target_value

      case 'price_above':
        // 가격이 목표가 이상으로 오르면 매도
        return currentPrice >= order.target_value

      case 'profit_rate':
        // 수익률이 목표 수익률 이상이면 매도
        return await this.checkProfitRate(order, currentPrice)

      default:
        return false
    }
  }

  /**
   * 수익률 조건 확인
   */
  private async checkProfitRate(order: PendingOrder, currentPrice: number): Promise<boolean> {
    const { data: holding } = await this.supabase
      .from('holdings')
      .select('average_cost')
      .eq('user_id', order.user_id)
      .eq('company_id', order.company_id)
      .maybeSingle()

    if (!holding || !holding.average_cost) return false

    const profitRate = ((currentPrice - holding.average_cost) / holding.average_cost) * 100
    return profitRate >= order.target_value
  }

  /**
   * 주문 체결: transactions 테이블에 INSERT 후 pending_orders 상태 업데이트
   * 매수: 에스크로에서 실제 체결가로 정산 (차액 환불)
   * 매도: 체결 금액을 포인트로 지급
   */
  private async executeOrder(order: PendingOrder, executionPrice: number) {
    try {
      const totalAmount = executionPrice * order.shares

      // 1. 트랜잭션 기록
      const { error: txError } = await this.supabase
        .from('transactions')
        .insert({
          user_id: order.user_id,
          company_id: order.company_id,
          transaction_type: order.order_type,
          shares: order.shares,
          price: executionPrice,
          total_amount: totalAmount
        })

      if (txError) {
        console.error(`[OrderExecutor] 트랜잭션 생성 실패 (order: ${order.id}):`, txError)
        return
      }

      // 2. 매수 주문인 경우: 에스크로 금액과 실제 체결 금액의 차액 환불
      if (order.order_type === 'buy') {
        const refundAmount = order.escrowed_amount - totalAmount
        if (refundAmount > 0) {
          // 체결가가 목표가보다 낮으면 차액 환불
          await this.supabase.rpc('increment_points', {
            user_id_input: order.user_id,
            amount_input: refundAmount
          })
        }
      }

      // 3. 매도 주문인 경우: 체결 금액을 포인트로 지급
      // (트랜잭션 트리거가 처리하지만, 에스크로 방식에서는 수동 처리)
      // 주식은 이미 에스크로 시 차감됨 → 포인트만 지급
      if (order.order_type === 'sell') {
        await this.supabase.rpc('increment_points', {
          user_id_input: order.user_id,
          amount_input: totalAmount
        })
      }

      // 4. 주문 상태 업데이트
      await this.supabase
        .from('pending_orders')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
          execution_price: executionPrice
        })
        .eq('id', order.id)

      console.log(`[OrderExecutor] 주문 체결: ${order.id} (${order.order_type} ${order.shares}주 @ ${executionPrice})`)

    } catch (error) {
      console.error(`[OrderExecutor] 주문 체결 실패 (order: ${order.id}):`, error)
    }
  }

  /**
   * 만료된 주문 처리 + 에스크로 환불
   */
  async expireOrders() {
    if (!this.supabase) await this.initialize()

    try {
      // 만료된 pending 주문 조회
      const { data: expiredOrders } = await this.supabase
        .from('pending_orders')
        .select('*')
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString())

      if (!expiredOrders || expiredOrders.length === 0) return

      for (const order of expiredOrders as PendingOrder[]) {
        await this.refundEscrow(order)

        await this.supabase
          .from('pending_orders')
          .update({ status: 'expired' })
          .eq('id', order.id)

        console.log(`[OrderExecutor] 주문 만료: ${order.id}`)
      }

    } catch (error) {
      console.error('[OrderExecutor] 만료 처리 중 오류:', error)
    }
  }

  /**
   * 에스크로 환불 (취소/만료 시)
   * 매수: 포인트 환불
   * 매도: 주식 환원
   */
  async refundEscrow(order: PendingOrder) {
    if (!this.supabase) await this.initialize()

    try {
      if (order.order_type === 'buy') {
        // 매수 주문: 에스크로 포인트 환불
        await this.supabase.rpc('increment_points', {
          user_id_input: order.user_id,
          amount_input: order.escrowed_amount
        })
      } else {
        // 매도 주문: 주식 환원
        const { data: holding } = await this.supabase
          .from('holdings')
          .select('shares')
          .eq('user_id', order.user_id)
          .eq('company_id', order.company_id)
          .maybeSingle()

        if (holding) {
          await this.supabase
            .from('holdings')
            .update({ shares: holding.shares + order.shares })
            .eq('user_id', order.user_id)
            .eq('company_id', order.company_id)
        }
      }
    } catch (error) {
      console.error(`[OrderExecutor] 에스크로 환불 실패 (order: ${order.id}):`, error)
    }
  }
}
