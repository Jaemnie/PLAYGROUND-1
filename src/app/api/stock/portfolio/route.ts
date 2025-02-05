import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // 예를 들어, user_id를 쿼리 파라미터로 받습니다.
  const { searchParams } = new URL(request.url)
  const user_id = searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ error: 'user_id 파라미터가 필요합니다.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('holdings')
    .select(`
      *,
      company:companies(*)
    `)
    .eq('user_id', user_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ holdings: data })
} 