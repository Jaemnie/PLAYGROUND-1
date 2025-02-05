'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

interface PortfolioSummaryProps {
  portfolio: any[]
  points: number
}

export function PortfolioSummary({ portfolio, points }: PortfolioSummaryProps) {
  const router = useRouter()
  const [totalValue, setTotalValue] = useState(0)
  const [totalGain, setTotalGain] = useState(0)
  const [gainPercentage, setGainPercentage] = useState(0)

  useEffect(() => {
    // 포트폴리오 총 가치 계산
    const value = portfolio.reduce((sum, holding) => {
      return sum + (holding.shares * holding.company.current_price)
    }, 0)
    
    // 총 손익 계산
    const gain = portfolio.reduce((sum, holding) => {
      const currentValue = holding.shares * holding.company.current_price
      const costBasis = holding.shares * holding.average_cost
      return sum + (currentValue - costBasis)
    }, 0)
    
    setTotalValue(value)
    setTotalGain(gain)
    setGainPercentage((gain / value) * 100)
  }, [portfolio])

  return (
    <>
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-100">포트폴리오 현황</h2>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-400">보유 포인트</p>
            <p className="text-2xl font-bold text-blue-400">
              {points?.toLocaleString() || 0} P
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">보유 주식 자산</p>
            <p className="text-2xl font-bold text-gray-100">
              {totalValue.toLocaleString()}원
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">총 손익</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalGain.toLocaleString()}원
              </p>
              <span className={`flex items-center ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalGain >= 0 ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                {Math.abs(gainPercentage).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
        
        <Button 
          className="w-full mt-6 bg-blue-500 hover:bg-blue-600"
          onClick={() => router.push('/dashboard/stock/portfolio')}
        >
          자세히 보기
        </Button>
      </CardContent>
    </>
  )
}
