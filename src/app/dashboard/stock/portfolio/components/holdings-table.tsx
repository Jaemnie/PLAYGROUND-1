'use client'

import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, ArrowRightLeft } from 'lucide-react'

interface HoldingsTableProps {
  portfolio: any[]
  user: any
  points: number
  onTradeClick: (holding: any) => void
}

export default function HoldingsTable({ portfolio, user, points, onTradeClick }: HoldingsTableProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-100">보유 주식</h2>
        {portfolio.length > 0 && (
          <span className="text-xs text-gray-500">{portfolio.length}종목</span>
        )}
      </div>
      
      <div className="space-y-2.5">
        {portfolio.map((holding, index) => {
          const { company, shares, average_cost } = holding
          const currentPrice = company.current_price
          const totalValue = shares * currentPrice
          const gainLoss = currentPrice - average_cost
          const gainLossPercent = (gainLoss / average_cost) * 100
          const totalGainLoss = gainLoss * shares
          const isProfit = gainLoss > 0
          const isFlat = gainLoss === 0

          const accentColor = isFlat
            ? 'border-gray-700'
            : isProfit
              ? 'border-emerald-500/40'
              : 'border-red-500/40'

          return (
            <motion.div
              key={holding.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`relative rounded-xl border-l-[3px] ${accentColor} bg-white/[0.02] hover:bg-white/[0.04] transition-colors`}
            >
              <div className="py-3.5 pl-4 pr-3">
                {/* 1행: 종목명 + 수익률 뱃지 + 거래 버튼 */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-gray-100 text-sm truncate">{company.name}</h3>
                        <span className="text-[11px] text-gray-500 shrink-0">{company.ticker}</span>
                      </div>
                    </div>
                    {/* 수익률 뱃지 */}
                    <div className={`
                      flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-medium shrink-0
                      ${isFlat 
                        ? 'text-gray-400 bg-gray-500/10' 
                        : isProfit 
                          ? 'text-emerald-400 bg-emerald-500/10' 
                          : 'text-red-400 bg-red-500/10'
                      }
                    `}>
                      {isFlat ? (
                        <Minus className="w-3 h-3" />
                      ) : isProfit ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {isProfit ? '+' : ''}{gainLossPercent.toFixed(2)}%
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTradeClick(holding)}
                    className="h-7 px-2 text-xs text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 shrink-0 ml-2"
                  >
                    <ArrowRightLeft className="w-3 h-3 mr-1" />
                    거래
                  </Button>
                </div>

                {/* 2행: 핵심 수치 - 한 줄에 정리 */}
                <div className="flex items-baseline justify-between">
                  {/* 좌측: 평가금액 + 수량 */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-white tabular-nums">
                      {Math.floor(totalValue).toLocaleString()}
                      <span className="text-xs text-gray-500 font-normal ml-0.5">원</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {shares.toLocaleString()}주
                    </span>
                  </div>

                  {/* 우측: 손익 금액 */}
                  <span className={`text-sm font-medium tabular-nums ${
                    isFlat ? 'text-gray-500' : isProfit ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {isProfit ? '+' : ''}{Math.floor(totalGainLoss).toLocaleString()}원
                  </span>
                </div>

                {/* 3행: 단가 비교 - 작은 보조 정보 */}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[11px] text-gray-500">
                    평균 {Math.floor(average_cost).toLocaleString()}원
                  </span>
                  <span className="text-[11px] text-gray-600">→</span>
                  <span className="text-[11px] text-gray-400">
                    현재 {Math.floor(currentPrice).toLocaleString()}원
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}

        {portfolio.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2">
            <span className="text-gray-500 text-sm">보유 중인 주식이 없습니다</span>
            <span className="text-gray-600 text-xs">주식 시뮬레이션에서 매수를 시작해보세요</span>
          </div>
        )}
      </div>
    </div>
  )
}
