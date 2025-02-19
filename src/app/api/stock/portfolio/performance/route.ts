import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface PortfolioSnapshot {
  created_at: string;
  holdings_value: number;
  realized_gains: number;
  cash_balance: number;
  total_investment: number;
  total_return_rate: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  const timeframe = searchParams.get('timeframe') || '1D'

  const supabase = await createClient()

  try {
    // 스냅샷 데이터 조회
    const { data: snapshots } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({ error: '포트폴리오 데이터가 없습니다.' }, { status: 404 })
    }

    // 시간대별 데이터 그룹화
    const performanceData = groupSnapshotsByTimeframe(snapshots, timeframe)

    // 최신 스냅샷으로 요약 정보 생성
    const latestSnapshot = snapshots[snapshots.length - 1]
    const summary = {
      totalRealizedGains: latestSnapshot.realized_gains,
      totalUnrealizedGains: latestSnapshot.holdings_value - latestSnapshot.total_investment,
      totalReturnRate: latestSnapshot.total_return_rate,
      initialInvestment: latestSnapshot.total_investment,
      currentPortfolioValue: latestSnapshot.holdings_value + latestSnapshot.cash_balance
    }

    return NextResponse.json({
      performance: performanceData,
      summary
    })
  } catch (error) {
    console.error('포트폴리오 성과 계산 오류:', error)
    return NextResponse.json({ error: '성과 데이터 조회 실패' }, { status: 500 })
  }
}

function formatTimestamp(timestamp: string, timeframe: string): string {
  const date = new Date(timestamp)
  switch(timeframe) {
    case '1D': return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    case '7D': return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    default: return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
}

function groupSnapshotsByTimeframe(snapshots: PortfolioSnapshot[], timeframe: string) {
  // 시간대별 그룹화 로직 구현
  // timeframe에 따라 다른 간격으로 데이터 그룹화
  return snapshots.map(snapshot => ({
    time: formatTimestamp(snapshot.created_at, timeframe),
    value: snapshot.total_return_rate
  }))
} 