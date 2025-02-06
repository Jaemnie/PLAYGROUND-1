'use client'

import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react'

interface HoldingsTableProps {
  portfolio: any[]
  user: any
  points: number
  onTradeClick: (holding: any) => void
}

export default function HoldingsTable({ portfolio, user, points, onTradeClick }: HoldingsTableProps) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-100 mb-6">보유 주식</h2>
      
      <div className="space-y-4">
        {portfolio.map((holding, index) => {
          const { company, shares, average_cost } = holding
          const currentPrice = company.current_price
          const totalValue = shares * currentPrice
          const gainLoss = currentPrice - average_cost
          const gainLossPercent = (gainLoss / average_cost) * 100
          const isProfit = gainLoss > 0

          return (
            <motion.div
              key={holding.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-black/20 backdrop-blur-sm rounded-2xl border border-white/5 p-4"
            >
              {/* 종목 기본 정보 */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-100">{company.name}</h3>
                  <span className="text-sm text-gray-400">{company.ticker}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTradeClick(holding)}
                  className="border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
                >
                  거래하기
                </Button>
              </div>

              {/* 보유 수량 및 평가금액 */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-sm text-gray-400 mb-1">보유 수량</div>
                  <div className="text-lg font-bold text-gray-100">
                    {shares.toLocaleString()}주
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">평가 금액</div>
                  <div className="text-lg font-bold text-gray-100">
                    {Math.floor(totalValue).toLocaleString()}원
                  </div>
                </div>
              </div>

              {/* 손익 정보 */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">평균 단가</div>
                    <div className="font-medium text-gray-100">
                      {Math.floor(average_cost).toLocaleString()}원
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">현재가</div>
                    <div className="font-medium text-gray-100">
                      {Math.floor(currentPrice).toLocaleString()}원
                    </div>
                  </div>
                </div>
                
                {/* 손익률 */}
                <div className="mt-3 flex items-center gap-2">
                  <div className={`
                    flex items-center gap-1 px-2 py-1 rounded-lg
                    ${isProfit ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}
                  `}>
                    {isProfit ? (
                      <ArrowUpIcon className="w-4 h-4" />
                    ) : (
                      <ArrowDownIcon className="w-4 h-4" />
                    )}
                    <span className="font-medium">
                      {Math.abs(gainLossPercent).toFixed(2)}%
                    </span>
                  </div>
                  <span className={`font-medium ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : '-'}{Math.abs(Math.floor(gainLoss)).toLocaleString()}원
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}

        {portfolio.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            보유 중인 주식이 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
