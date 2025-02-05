import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  const timeframe = searchParams.get('timeframe') || '1M'

  if (!userId) {
    return NextResponse.json({ error: 'user_id가 필요합니다.' }, { status: 400 })
  }

  const supabase = await createClient()
  
  // 시간 범위 계산
  const now = new Date()
  const startDate = new Date()
  
  switch (timeframe) {
    case '1D':
      startDate.setDate(now.getDate() - 1)
      break
    case '1W':
      startDate.setDate(now.getDate() - 7)
      break
    case '1M':
      startDate.setMonth(now.getMonth() - 1)
      break
    case '3M':
      startDate.setMonth(now.getMonth() - 3)
      break
    case '1Y':
      startDate.setFullYear(now.getFullYear() - 1)
      break
  }

  const { data, error } = await supabase
    .from('portfolio_performance')
    .select('recorded_at, profit_rate')
    .eq('user_id', userId)
    .gte('recorded_at', startDate.toISOString())
    .order('recorded_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    performance: data.map(item => ({
      time: new Date(item.recorded_at).toLocaleDateString(),
      value: Number(item.profit_rate.toFixed(2))
    }))
  })
} 