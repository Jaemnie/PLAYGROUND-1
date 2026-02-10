import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

// GET: 단일 조건 주문 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pending_orders')
    .select(`
      *,
      company:companies(id, name, ticker, current_price, last_closing_price)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ order: data })
}

// DELETE: 조건 주문 취소 + 에스크로 환불
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  try {
    // 주문 조회
    const { data: order, error: fetchError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: '대기 중인 주문만 취소할 수 있습니다.' }, { status: 400 })
    }

    // 에스크로 환불
    if (order.order_type === 'buy') {
      // 매수 주문: 포인트 환불
      const { data: profile } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', order.user_id)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({ points: profile.points + order.escrowed_amount })
          .eq('id', order.user_id)
      }
    } else {
      // 매도 주문: 주식 환원
      const { data: holding } = await supabase
        .from('holdings')
        .select('shares')
        .eq('user_id', order.user_id)
        .eq('company_id', order.company_id)
        .maybeSingle()

      if (holding) {
        await supabase
          .from('holdings')
          .update({ shares: holding.shares + order.shares })
          .eq('user_id', order.user_id)
          .eq('company_id', order.company_id)
      }
    }

    // 주문 상태 업데이트
    const { error: updateError } = await supabase
      .from('pending_orders')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: '주문 취소에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '주문이 취소되었습니다.' })
  } catch (err) {
    console.error('[pending-orders] DELETE error:', err)
    return NextResponse.json({ error: '주문 취소 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
