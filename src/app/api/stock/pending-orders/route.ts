import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: 사용자의 조건 주문 목록 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const status = searchParams.get('status') // optional: 'pending', 'executed', 'cancelled', 'expired'

    if (!userId) {
      return NextResponse.json({ error: 'user_id가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('pending_orders')
      .select(`
        *,
        company:companies(id, name, ticker, current_price, last_closing_price)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ orders: data })
  } catch (err) {
    return NextResponse.json({ error: '조건 주문 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST: 조건 주문 생성 + 에스크로 처리
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      user_id,
      company_id,
      order_type,        // 'buy' | 'sell'
      condition_type,    // 'price_above' | 'price_below' | 'profit_rate'
      target_value,      // 목표 가격 또는 수익률(%)
      shares,
      expires_in_days    // 0(당일) | 3 | 7
    } = body

    // 유효성 검증
    if (!user_id || !company_id || !order_type || !condition_type || !target_value || !shares) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }

    if (shares <= 0) {
      return NextResponse.json({ error: '수량은 1 이상이어야 합니다.' }, { status: 400 })
    }

    if (!['buy', 'sell'].includes(order_type)) {
      return NextResponse.json({ error: '유효하지 않은 주문 유형입니다.' }, { status: 400 })
    }

    if (!['price_above', 'price_below', 'profit_rate'].includes(condition_type)) {
      return NextResponse.json({ error: '유효하지 않은 조건 유형입니다.' }, { status: 400 })
    }

    // 매수 + price_above 조합은 불가 (가격이 올라갈 때 매수는 비합리적)
    if (order_type === 'buy' && condition_type === 'price_above') {
      return NextResponse.json({ error: '매수 주문은 "가격 이하 도달 시" 조건만 가능합니다.' }, { status: 400 })
    }

    // 매수 + profit_rate 조합은 불가
    if (order_type === 'buy' && condition_type === 'profit_rate') {
      return NextResponse.json({ error: '수익률 조건은 매도 주문에서만 사용 가능합니다.' }, { status: 400 })
    }

    // 만료 시간 계산
    const expiresAt = new Date()
    const days = expires_in_days === 0 ? 0 : (expires_in_days || 1)
    if (days === 0) {
      // 당일: 오늘 24시 (자정)
      expiresAt.setHours(24, 0, 0, 0)
    } else {
      expiresAt.setDate(expiresAt.getDate() + days)
      expiresAt.setHours(24, 0, 0, 0)
    }

    // 에스크로 처리
    let escrowedAmount = 0

    if (order_type === 'buy') {
      // 매수: 포인트 에스크로
      escrowedAmount = target_value * shares

      // 현재 포인트 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', user_id)
        .single()

      if (!profile || profile.points < escrowedAmount) {
        return NextResponse.json({ error: '포인트가 부족합니다.' }, { status: 400 })
      }

      // 포인트 차감
      const { error: pointsError } = await supabase
        .from('profiles')
        .update({ points: profile.points - escrowedAmount })
        .eq('id', user_id)

      if (pointsError) {
        return NextResponse.json({ error: '포인트 차감에 실패했습니다.' }, { status: 500 })
      }

    } else {
      // 매도: 주식 에스크로
      const { data: holding } = await supabase
        .from('holdings')
        .select('shares')
        .eq('user_id', user_id)
        .eq('company_id', company_id)
        .maybeSingle()

      if (!holding || holding.shares < shares) {
        return NextResponse.json({ error: '보유 주식이 부족합니다.' }, { status: 400 })
      }

      // 주식 수량 차감
      const { error: holdingError } = await supabase
        .from('holdings')
        .update({ shares: holding.shares - shares })
        .eq('user_id', user_id)
        .eq('company_id', company_id)

      if (holdingError) {
        return NextResponse.json({ error: '주식 잠금에 실패했습니다.' }, { status: 500 })
      }
    }

    // 조건 주문 생성
    const { data: order, error: orderError } = await supabase
      .from('pending_orders')
      .insert({
        user_id,
        company_id,
        order_type,
        condition_type,
        target_value,
        shares,
        escrowed_amount: escrowedAmount,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (orderError) {
      // 주문 생성 실패 시 에스크로 복구 시도
      if (order_type === 'buy') {
        await supabase
          .from('profiles')
          .update({ points: (await supabase.from('profiles').select('points').eq('id', user_id).single()).data!.points + escrowedAmount })
          .eq('id', user_id)
      } else {
        const { data: h } = await supabase.from('holdings').select('shares').eq('user_id', user_id).eq('company_id', company_id).maybeSingle()
        if (h) {
          await supabase.from('holdings').update({ shares: h.shares + shares }).eq('user_id', user_id).eq('company_id', company_id)
        }
      }
      return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[pending-orders] POST error:', err)
    return NextResponse.json({ error: '조건 주문 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
