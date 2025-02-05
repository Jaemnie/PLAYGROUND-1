import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const data = await request.json()

    const { data: section, error } = await supabase
      .from('guide_sections')
      .insert([data])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(section)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: '섹션 생성에 실패했습니다' },
      { status: 500 }
    )
  }
} 