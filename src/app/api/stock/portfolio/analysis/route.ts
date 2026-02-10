import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface TradeRecord {
  transaction_type: 'buy' | 'sell'
  shares: number
  price: number
  total_amount: number
  created_at: string
  company: {
    id: string
    name: string
    ticker: string
    industry: string
    current_price: number
  }
}

interface HoldingRecord {
  shares: number
  average_cost: number
  company: {
    id: string
    name: string
    ticker: string
    industry: string
    current_price: number
  }
}

// 투자 성향 판단
function analyzeStyle(trades: TradeRecord[], holdingCount: number) {
  if (trades.length === 0) return { style: 'beginner' as const, label: '초보 투자자' }

  const sellCount = trades.filter(t => t.transaction_type === 'sell').length
  const buyCount = trades.filter(t => t.transaction_type === 'buy').length
  const sellRatio = trades.length > 0 ? sellCount / trades.length : 0

  // 거래 빈도 (일 평균)
  const firstTrade = new Date(trades[trades.length - 1].created_at)
  const lastTrade = new Date(trades[0].created_at)
  const daySpan = Math.max((lastTrade.getTime() - firstTrade.getTime()) / (1000 * 60 * 60 * 24), 1)
  const tradesPerDay = trades.length / daySpan

  if (tradesPerDay > 5 || sellRatio > 0.6) {
    return { style: 'aggressive' as const, label: '공격적 트레이더' }
  }
  if (tradesPerDay > 2 || (holdingCount >= 3 && sellRatio > 0.3)) {
    return { style: 'active' as const, label: '적극적 투자자' }
  }
  if (holdingCount >= 2) {
    return { style: 'balanced' as const, label: '균형 투자자' }
  }
  return { style: 'conservative' as const, label: '안정형 투자자' }
}

// 승률 계산 (매도 거래 중 이익 실현 비율)
function calculateWinRate(trades: TradeRecord[]) {
  const sells = trades.filter(t => t.transaction_type === 'sell')
  if (sells.length === 0) return { winRate: 0, wins: 0, losses: 0, totalSells: 0 }

  // 매도 시점의 가격과 같은 종목 최근 매수 평균가 비교
  const buyPrices: Record<string, number[]> = {}
  
  // 시간순 정렬 (오래된 것 먼저)
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  let wins = 0
  let losses = 0

  for (const trade of sortedTrades) {
    const companyId = trade.company.id
    if (trade.transaction_type === 'buy') {
      if (!buyPrices[companyId]) buyPrices[companyId] = []
      buyPrices[companyId].push(trade.price)
    } else {
      const buys = buyPrices[companyId]
      if (buys && buys.length > 0) {
        const avgBuyPrice = buys.reduce((s, p) => s + p, 0) / buys.length
        if (trade.price > avgBuyPrice) wins++
        else losses++
      } else {
        // 매수 기록이 없는 경우 (데이터 부족)
        losses++
      }
    }
  }

  const totalSells = wins + losses
  return {
    winRate: totalSells > 0 ? Math.round((wins / totalSells) * 100) : 0,
    wins,
    losses,
    totalSells
  }
}

// 다각화 점수 계산 (HHI 기반 - stock 대시보드와 동일 방식)
function calculateDiversification(holdings: HoldingRecord[]) {
  if (holdings.length === 0) return { score: 0, sectors: {}, topHoldingPct: 0 }

  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.company.current_price, 0)
  if (totalValue === 0) return { score: 0, sectors: {}, topHoldingPct: 0 }

  // 섹터별 분포
  const sectors: Record<string, number> = {}
  let maxPct = 0

  for (const holding of holdings) {
    const value = holding.shares * holding.company.current_price
    const pct = (value / totalValue) * 100
    const sector = holding.company.industry || '기타'
    sectors[sector] = (sectors[sector] || 0) + pct
    if (pct > maxPct) maxPct = pct
  }

  // HHI (Herfindahl-Hirschman Index) 기반 점수
  // 섹터별 비중의 제곱합 → 0(완전 분산)~1(완전 집중)
  const sectorPcts = Object.values(sectors)
  const hhi = sectorPcts.reduce((sum, pct) => sum + Math.pow(pct / 100, 2), 0)
  const score = Math.round(Math.max(0, Math.min(100, (1 - hhi) * 100)))

  return {
    score: Math.round(score),
    sectors,
    topHoldingPct: Math.round(maxPct)
  }
}

// 인사이트 생성
function generateInsights(
  trades: TradeRecord[],
  holdings: HoldingRecord[],
  winData: ReturnType<typeof calculateWinRate>,
  diversification: ReturnType<typeof calculateDiversification>,
  points: number
) {
  const insights: Array<{ type: 'positive' | 'warning' | 'tip'; text: string }> = []

  // 거래 기반 인사이트
  if (trades.length === 0) {
    insights.push({ type: 'tip', text: '아직 거래 내역이 없습니다. 관심 있는 종목에 소액부터 투자를 시작해보세요.' })
    return insights
  }

  // 승률 피드백
  if (winData.totalSells >= 3) {
    if (winData.winRate >= 70) {
      insights.push({ type: 'positive', text: `매도 승률이 ${winData.winRate}%로 매우 우수합니다. 매도 타이밍을 잘 잡고 있습니다.` })
    } else if (winData.winRate >= 50) {
      insights.push({ type: 'positive', text: `매도 승률 ${winData.winRate}%. 절반 이상 수익 실현에 성공하고 있습니다.` })
    } else {
      insights.push({ type: 'warning', text: `매도 승률이 ${winData.winRate}%로 낮습니다. 손절 기준을 재점검하고, 조급한 매도를 자제해보세요.` })
    }
  }

  // 다각화 피드백
  if (holdings.length === 1) {
    insights.push({ type: 'warning', text: '한 종목에만 집중 투자 중입니다. 리스크 분산을 위해 다른 섹터의 종목도 고려해보세요.' })
  } else if (holdings.length >= 2 && diversification.topHoldingPct > 60) {
    insights.push({ type: 'warning', text: `포트폴리오의 ${diversification.topHoldingPct}%가 한 종목에 집중되어 있습니다. 비중 조절을 검토해보세요.` })
  } else if (Object.keys(diversification.sectors).length >= 3) {
    insights.push({ type: 'positive', text: `${Object.keys(diversification.sectors).length}개 섹터에 분산 투자 중입니다. 리스크 관리가 잘 되고 있습니다.` })
  }

  // 현금 비중 분석
  const stockValue = holdings.reduce((sum, h) => sum + h.shares * h.company.current_price, 0)
  const totalAssets = points + stockValue
  const cashRatio = totalAssets > 0 ? (points / totalAssets) * 100 : 100

  if (cashRatio > 80) {
    insights.push({ type: 'tip', text: `현금 비중이 ${Math.round(cashRatio)}%입니다. 여유 자금을 활용한 분산 투자를 고려해보세요.` })
  } else if (cashRatio < 10) {
    insights.push({ type: 'warning', text: `현금 비중이 ${Math.round(cashRatio)}%로 매우 낮습니다. 급락 시 추가 매수 여력이 부족할 수 있습니다.` })
  } else if (cashRatio >= 20 && cashRatio <= 40) {
    insights.push({ type: 'positive', text: `현금 비중 ${Math.round(cashRatio)}%로 적절한 유동성을 확보하고 있습니다.` })
  }

  // 미실현 손익 분석
  const unrealizedHoldings = holdings.filter(h => {
    const gain = (h.company.current_price - h.average_cost) / h.average_cost * 100
    return Math.abs(gain) > 10
  })

  for (const h of unrealizedHoldings) {
    const gain = (h.company.current_price - h.average_cost) / h.average_cost * 100
    if (gain > 20) {
      insights.push({ type: 'tip', text: `${h.company.name}이(가) +${gain.toFixed(1)}% 상승 중입니다. 일부 익절을 통해 수익을 확정하는 것도 전략입니다.` })
    } else if (gain < -15) {
      insights.push({ type: 'warning', text: `${h.company.name}이(가) ${gain.toFixed(1)}% 하락 중입니다. 손절 라인을 설정하고 추가 하락에 대비하세요.` })
    }
  }

  // 거래 패턴
  const buyCount = trades.filter(t => t.transaction_type === 'buy').length
  const sellCount = trades.filter(t => t.transaction_type === 'sell').length
  if (buyCount > 0 && sellCount === 0) {
    insights.push({ type: 'tip', text: '매수만 진행하고 매도 경험이 없습니다. 목표 수익률을 설정하고 적절한 시점에 매도 연습을 해보세요.' })
  }

  return insights.slice(0, 5) // 최대 5개
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')

  if (!userId) {
    return NextResponse.json({ error: 'user_id가 필요합니다.' }, { status: 400 })
  }

  const supabase = await createClient()

  // 병렬로 모든 데이터 조회
  const [
    { data: transactions },
    { data: holdings },
    { data: profile }
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select(`
        transaction_type, shares, price, total_amount, created_at,
        company:companies(id, name, ticker, industry, current_price)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('holdings')
      .select(`
        shares, average_cost,
        company:companies(id, name, ticker, industry, current_price)
      `)
      .eq('user_id', userId),
    supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single()
  ])

  const trades = (transactions || []) as unknown as TradeRecord[]
  const holds = (holdings || []) as unknown as HoldingRecord[]
  const points = Number(profile?.points || 0)

  // 분석 실행
  const style = analyzeStyle(trades, holds.length)
  const winData = calculateWinRate(trades)
  const diversification = calculateDiversification(holds)
  const insights = generateInsights(trades, holds, winData, diversification, points)

  // 총 투자금액 / 총 수익
  const totalBuyAmount = trades
    .filter(t => t.transaction_type === 'buy')
    .reduce((sum, t) => sum + Number(t.total_amount), 0)
  const totalSellAmount = trades
    .filter(t => t.transaction_type === 'sell')
    .reduce((sum, t) => sum + Number(t.total_amount), 0)
  const unrealizedGain = holds.reduce((sum, h) => 
    sum + (h.company.current_price - h.average_cost) * h.shares, 0)
  const realizedGain = totalSellAmount - totalBuyAmount + holds.reduce((sum, h) => 
    sum + h.average_cost * h.shares, 0)

  // 종합 점수 (0~100)
  const winScore = Math.min(winData.winRate, 100) * 0.3
  const divScore = diversification.score * 0.25
  const tradeScore = trades.length > 0 ? 25 : 0
  const balanceScore = (() => {
    const stockValue = holds.reduce((s, h) => s + h.shares * h.company.current_price, 0)
    const total = points + stockValue
    const cashPct = total > 0 ? (points / total) * 100 : 100
    if (cashPct >= 15 && cashPct <= 50) return 20
    if (cashPct >= 10 && cashPct <= 60) return 15
    return 5
  })()
  const overallScore = Math.round(Math.min(100, winScore + divScore + tradeScore + balanceScore))

  return NextResponse.json({
    style,
    overallScore,
    stats: {
      totalTrades: trades.length,
      buyCount: trades.filter(t => t.transaction_type === 'buy').length,
      sellCount: trades.filter(t => t.transaction_type === 'sell').length,
      winRate: winData.winRate,
      wins: winData.wins,
      losses: winData.losses,
      holdingCount: holds.length,
    },
    diversification: {
      score: diversification.score,
      sectors: diversification.sectors,
      topHoldingPct: diversification.topHoldingPct,
    },
    insights,
    analyzedAt: new Date().toISOString(),
  })
}
