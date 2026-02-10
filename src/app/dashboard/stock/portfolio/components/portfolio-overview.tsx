'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Target,
  PieChart,
  BarChart3,
  RefreshCw,
  Wallet,
  LineChart
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type LockedSharesMap = Map<string, number>

interface PortfolioOverviewProps {
  user: { id: string }
  portfolio: any[]
  points: number
  lockedShares?: LockedSharesMap
}

interface Insight {
  type: 'positive' | 'warning' | 'tip'
  text: string
}

interface AnalysisData {
  style: { style: string; label: string }
  overallScore: number
  stats: {
    totalTrades: number
    buyCount: number
    sellCount: number
    winRate: number
    wins: number
    losses: number
    holdingCount: number
  }
  diversification: {
    score: number
    sectors: Record<string, number>
    topHoldingPct: number
  }
  insights: Insight[]
  analyzedAt: string
}

const STYLE_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof TrendingUp }> = {
  aggressive: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: TrendingUp },
  active: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: BarChart3 },
  balanced: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: PieChart },
  conservative: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Target },
  beginner: { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: Sparkles },
}

const INSIGHT_CONFIG = {
  positive: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/10' },
  tip: { icon: Lightbulb, color: 'text-blue-400', bg: 'bg-blue-500/5', border: 'border-blue-500/10' },
}

function ScoreRing({ score }: { score: number }) {
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171'

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#1f2937" strokeWidth="5" />
        <motion.circle
          cx="36" cy="36" r={radius} fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-xl font-bold text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[9px] text-gray-500 -mt-0.5">점</span>
      </div>
    </div>
  )
}

export default function PortfolioOverview({ user, portfolio, points, lockedShares }: PortfolioOverviewProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 포트폴리오 현황 계산 (잠긴 주식 포함)
  const stocksValue = portfolio.reduce((sum, h) => {
    const locked = lockedShares?.get(h.company.id) || 0
    return sum + ((h.shares + locked) * h.company.current_price)
  }, 0)
  const investedAmount = portfolio.reduce((sum, h) => {
    const locked = lockedShares?.get(h.company.id) || 0
    return sum + ((h.shares + locked) * h.average_cost)
  }, 0)
  const totalAssets = points + stocksValue
  const unrealizedGain = stocksValue - investedAmount
  const gainPct = investedAmount > 0 ? (unrealizedGain / investedAmount) * 100 : 0
  const isGainPositive = unrealizedGain >= 0

  const fetchAnalysis = async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true)
      else setIsLoading(true)
      const response = await fetch(`/api/stock/portfolio/analysis?user_id=${user.id}`)
      const result = await response.json()
      setAnalysis(result)
    } catch (error) {
      console.error('투자 분석 로딩 오류:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (user?.id) fetchAnalysis()
  }, [user?.id])

  const styleConfig = analysis
    ? STYLE_CONFIG[analysis.style.style] || STYLE_CONFIG.beginner
    : STYLE_CONFIG.beginner
  const StyleIcon = styleConfig.icon

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-semibold text-gray-100">포트폴리오 리포트</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchAnalysis(true)}
          disabled={isRefreshing}
          className="h-7 px-2 text-gray-500 hover:text-gray-300"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 상단: 자산 현황 + 분석 점수 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 왼쪽: 자산 현황 */}
        <div className="space-y-4">
          {/* 총 자산 */}
          <div>
            <p className="text-xs text-gray-500 mb-1">총 자산</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              {Math.floor(totalAssets).toLocaleString()}
              <span className="text-lg text-gray-400 ml-1">원</span>
            </p>
          </div>

          {/* 보유 포인트 / 주식 자산 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="w-3 h-3 text-blue-400" />
                <span className="text-[11px] text-gray-500">보유 포인트</span>
              </div>
              <p className="text-lg font-bold text-blue-400">
                {Math.floor(points).toLocaleString()}
                <span className="text-xs text-blue-400/60 ml-0.5">P</span>
              </p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <LineChart className="w-3 h-3 text-gray-400" />
                <span className="text-[11px] text-gray-500">주식 평가</span>
              </div>
              <p className="text-lg font-bold text-gray-100">
                {Math.floor(stocksValue).toLocaleString()}
                <span className="text-xs text-gray-500 ml-0.5">원</span>
              </p>
            </div>
          </div>

          {/* 투자금 / 미실현 손익 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <span className="text-[11px] text-gray-500">총 투자금</span>
              <p className="text-sm font-semibold text-gray-200 mt-0.5">
                {Math.floor(investedAmount).toLocaleString()}원
              </p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <span className="text-[11px] text-gray-500">미실현 손익</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className={`text-sm font-semibold ${isGainPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isGainPositive ? '+' : ''}{Math.floor(unrealizedGain).toLocaleString()}원
                </p>
                <span className={`text-xs ${isGainPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {isGainPositive ? '+' : ''}{gainPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 분석 점수 */}
        <div className="flex flex-col items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-5 h-5 text-violet-400" />
              </motion.div>
              <span className="text-xs text-gray-500">분석 중...</span>
            </div>
          ) : analysis ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <ScoreRing score={analysis.overallScore} />
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium ${styleConfig.bg} ${styleConfig.color} border ${styleConfig.border}`}>
                <StyleIcon className="w-3.5 h-3.5" />
                {analysis.style.label}
              </div>
              <div className="grid grid-cols-3 gap-4 w-full mt-1">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{analysis.stats.totalTrades}</div>
                  <div className="text-[10px] text-gray-500">총 거래</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white">
                    {analysis.stats.winRate}<span className="text-xs text-gray-500">%</span>
                  </div>
                  <div className="text-[10px] text-gray-500">승률</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{analysis.stats.holdingCount}</div>
                  <div className="text-[10px] text-gray-500">보유 종목</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 분석 로딩 완료 후 하단 영역 */}
      {analysis && (
        <>
          {/* 구분선 */}
          <div className="border-t border-white/5" />

          {/* 거래 통계 바 */}
          {analysis.stats.totalTrades > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>매수 {analysis.stats.buyCount}회</span>
                <span>매도 {analysis.stats.sellCount}회</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                <motion.div
                  className="bg-blue-500 rounded-l-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(analysis.stats.buyCount / analysis.stats.totalTrades) * 100}%`
                  }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
                <motion.div
                  className="bg-red-500 rounded-r-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(analysis.stats.sellCount / analysis.stats.totalTrades) * 100}%`
                  }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                />
              </div>
              {(analysis.stats.wins > 0 || analysis.stats.losses > 0) && (
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-400">{analysis.stats.wins}승</span>
                  <span className="text-red-400">{analysis.stats.losses}패</span>
                </div>
              )}
            </div>
          )}

          {/* 다각화 점수 */}
          {analysis.stats.holdingCount > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">포트폴리오 다각화</span>
                <span className="text-gray-400 font-medium">{analysis.diversification.score}점</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    analysis.diversification.score >= 60 ? 'bg-emerald-500' :
                    analysis.diversification.score >= 35 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${analysis.diversification.score}%` }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                />
              </div>
              {Object.keys(analysis.diversification.sectors).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(analysis.diversification.sectors).map(([sector, pct]) => (
                    <span
                      key={sector}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400"
                    >
                      {sector} {Math.round(pct as number)}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 인사이트 */}
          {analysis.insights.length > 0 && (
            <>
              <div className="border-t border-white/5" />
              <AnimatePresence>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">투자 피드백</p>
                  {analysis.insights.map((insight, index) => {
                    const config = INSIGHT_CONFIG[insight.type]
                    const Icon = config.icon
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.12 }}
                        className={`flex gap-2.5 p-2.5 rounded-xl border ${config.bg} ${config.border}`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                        <p className="text-xs text-gray-300 leading-relaxed">{insight.text}</p>
                      </motion.div>
                    )
                  })}
                </div>
              </AnimatePresence>
            </>
          )}

          {/* 분석 시간 */}
          <div className="text-[10px] text-gray-600 text-right">
            마지막 분석: {new Date(analysis.analyzedAt).toLocaleString('ko-KR')}
          </div>
        </>
      )}
    </div>
  )
}
