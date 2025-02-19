import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PortfolioTracker } from '@/services/portfolio-tracker'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user_id, company_id, transaction_type, shares, price } = await request.json()
  
  try {
    const { data: holding } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', user_id)
      .eq('company_id', company_id)
      .single()

    const total_amount = shares * price
    
    // 트랜잭션 시작
    const { data: transaction } = await supabase
      .from('transactions')
      .insert({
        user_id,
        company_id,
        transaction_type,
        shares,
        price,
        total_amount,
        purchase_price: transaction_type === 'buy' ? price : holding?.average_cost || 0
      })
      .select()
      .single()

    if (transaction_type === 'buy') {
      // 매수 시 holdings 업데이트
      if (holding) {
        const new_shares = holding.shares + shares
        const new_total_cost = (holding.shares * holding.average_cost) + total_amount
        const new_average_cost = new_total_cost / new_shares
        
        await supabase
          .from('holdings')
          .update({
            shares: new_shares,
            average_cost: new_average_cost,
            unrealized_gain: (price - new_average_cost) * new_shares
          })
          .eq('id', holding.id)
      } else {
        await supabase
          .from('holdings')
          .insert({
            user_id,
            company_id,
            shares,
            average_cost: price,
            unrealized_gain: 0,
            total_realized_gain: 0,
            first_purchase_date: new Date().toISOString()
          })
      }
    } else {
      // 매도 시 holdings 업데이트
      const realized_gain = (price - holding.average_cost) * shares
      const remaining_shares = holding.shares - shares
      
      if (remaining_shares > 0) {
        await supabase
          .from('holdings')
          .update({
            shares: remaining_shares,
            total_realized_gain: holding.total_realized_gain + realized_gain,
            unrealized_gain: (price - holding.average_cost) * remaining_shares
          })
          .eq('id', holding.id)
      } else {
        await supabase
          .from('holdings')
          .delete()
          .eq('id', holding.id)
      }
    }

    // 현금 잔액 업데이트
    const { data: currentBalance } = await supabase
      .from('profiles')
      .select('cash_balance')
      .eq('id', user_id)
      .single()

    const newBalance = transaction_type === 'buy'
      ? (currentBalance?.cash_balance || 0) - total_amount
      : (currentBalance?.cash_balance || 0) + total_amount

    await supabase
      .from('profiles')
      .update({ cash_balance: newBalance })
      .eq('id', user_id)

    // 포트폴리오 스냅샷 기록
    const tracker = new PortfolioTracker()
    await tracker.recordPerformance(user_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('거래 처리 중 오류:', error)
    return NextResponse.json({ error: '거래 처리 실패' }, { status: 500 })
  }
} 