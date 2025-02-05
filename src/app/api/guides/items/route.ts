import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const data = await request.json()

    const { data: item, error } = await supabase
      .from('guide_items')
      .insert([data])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: '아이템 생성에 실패했습니다' },
      { status: 500 }
    )
  }
} 