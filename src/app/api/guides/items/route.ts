import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const data = await request.json()
    
    console.log('Received data:', data)
    
    // 필수 필드 검증
    if (!data.title || !data.section_id || !data.created_by) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다', missing: { 
          title: !data.title, 
          section_id: !data.section_id, 
          created_by: !data.created_by 
        }},
        { status: 400 }
      )
    }
    
    // created_at과 updated_at이 없으면 현재 시간으로 설정
    if (!data.created_at) data.created_at = new Date().toISOString()
    if (!data.updated_at) data.updated_at = new Date().toISOString()
    
    const { data: item, error } = await supabase
      .from('guide_items')
      .insert([data])
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: '아이템 생성에 실패했습니다', details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: '아이템 생성에 실패했습니다', details: error.message },
      { status: 500 }
    )
  }
} 