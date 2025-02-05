import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  // await 키워드를 통해 비동기 params 값을 동기적으로 얻음
  const { ticker } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('ticker', ticker)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: '회사 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ company: data })
} 