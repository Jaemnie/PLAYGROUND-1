'use client'

import { CardHeader, CardContent } from '@/components/ui/card'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'

interface PortfolioAnalysisProps {
  portfolio: any[]
  points: number
}

export default function PortfolioAnalysis({ portfolio, points }: PortfolioAnalysisProps) {
  // 보유 주식의 총 평가 금액 계산
  const stocksValue = portfolio.reduce((sum, holding) => {
    return sum + (holding.shares * holding.company.current_price)
  }, 0)
  
  // 투자 비용의 총합 계산
  const investedAmount = portfolio.reduce((sum, holding) => {
    return sum + (holding.shares * holding.average_cost)
  }, 0)
  
  const totalGain = stocksValue - investedAmount
  const gainPercentage = investedAmount > 0 ? (totalGain / investedAmount) * 100 : 0
  const isGainPositive = totalGain >= 0

  return (
    <>
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-100">포트폴리오 현황</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400">보유 포인트</p>
            <p className="text-2xl font-bold text-blue-400">{Math.floor(points).toLocaleString()} P</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">주식 자산</p>
            <p className="text-2xl font-bold text-gray-100">{Math.floor(stocksValue).toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">총 투자금액</p>
            <p className="text-2xl font-bold text-gray-100">{Math.floor(investedAmount).toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">총 손익</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${isGainPositive ? 'text-green-500' : 'text-red-500'}`}>
                {Math.floor(totalGain).toLocaleString()}원
              </p>
              <span className={`flex items-center ${isGainPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isGainPositive ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                {Math.abs(gainPercentage).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  )
}