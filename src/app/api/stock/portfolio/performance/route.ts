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
      startTime.setMinutes(now.getMinutes() - 60)
      break
    case '30M':
      startTime.setHours(now.getHours() - 12)
      break
    case '1H':
      startTime.setHours(now.getHours() - 24)
      break
    case '1D':
      startTime.setDate(now.getDate() - 7)
      break
    case '7D':
      startTime.setDate(now.getDate() - 30)
      break
  }

  const { data, error } = await supabase
    .from('portfolio_performance')
    .select('recorded_at, total_assets, total_value, total_profit, profit_rate')
    .eq('user_id', userId)
    .gte('recorded_at', startTime.toISOString())
    .order('recorded_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const formatTime = (timestamp: string, tf: string) => {
    const date = new Date(timestamp)
    switch (tf) {
      case '1M':
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

  // total_assets가 0인 데이터(마이그레이션 이전 데이터)는 제외
  const validData = data.filter(item => item.total_assets > 0)

  // 선택 기간의 시작점 대비 변화 계산
  const firstAssets = validData.length > 0 ? Number(validData[0].total_assets) : 0
  const lastAssets = validData.length > 0 ? Number(validData[validData.length - 1].total_assets) : 0
  const periodChange = lastAssets - firstAssets
  const periodChangeRate = firstAssets > 0 ? (periodChange / firstAssets) * 100 : 0

  return NextResponse.json({
    performance: validData.map(item => ({
      time: formatTime(item.recorded_at, timeframe),
      totalAssets: Math.floor(Number(item.total_assets)),
      stockValue: Math.floor(Number(item.total_value)),
      profit: Math.floor(Number(item.total_profit)),
    })),
    summary: {
      periodChange: Math.floor(periodChange),
      periodChangeRate: Number(periodChangeRate.toFixed(2)),
      startAssets: Math.floor(firstAssets),
      currentAssets: Math.floor(lastAssets),
    }
  })
} 