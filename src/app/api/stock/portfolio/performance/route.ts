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
  const startTime = new Date()

  switch (timeframe) {
    case '1M':
      startTime.setMinutes(now.getMinutes() - 60) // 최근 60분의 1분봉
      break
    case '30M':
      startTime.setHours(now.getHours() - 12) // 최근 12시간의 30분봉
      break
    case '1H':
      startTime.setHours(now.getHours() - 24) // 최근 24시간의 1시간봉
      break
    case '1D':
      startTime.setDate(now.getDate() - 7) // 최근 7일의 일봉
      break
    case '7D':
      startTime.setDate(now.getDate() - 30) // 최근 30일의 주봉
      break
  }

  const { data, error } = await supabase
    .from('portfolio_performance')
    .select('recorded_at, profit_rate')
    .eq('user_id', userId)
    .gte('recorded_at', startTime.toISOString())
    .order('recorded_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const formatTime = (timestamp: string, timeframe: string) => {
    const date = new Date(timestamp)
    switch (timeframe) {
      case '1M':
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      case '30M':
      case '1H':
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      case '1D':
        return date.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit'
        })
      case '7D':
        return date.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric'
        })
      default:
        return date.toLocaleString('ko-KR')
    }
  }

  return NextResponse.json({
    performance: data.map(item => ({
      time: formatTime(item.recorded_at, timeframe),
      value: Number(item.profit_rate.toFixed(2))
    }))
  })
} 