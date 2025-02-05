import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // 필요한 필드: user_id, company_id, shares, order_type, price 등 (유효성 검증 필요)
    const { data, error } = await supabase
      .from('orders')
      .insert([body])
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ order: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: '주문 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
} 