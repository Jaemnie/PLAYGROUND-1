'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'
import { motion, AnimatePresence } from 'framer-motion'

interface PortfolioSummaryProps {
  portfolio: any[]
  points: number
}

export function PortfolioSummary({ portfolio: initialPortfolio, points }: PortfolioSummaryProps) {
  const router = useRouter()
  const [totalValue, setTotalValue] = useState(0)
  const [totalGain, setTotalGain] = useState(0)
  const [gainPercentage, setGainPercentage] = useState(0)

  const companyIds = initialPortfolio.map(h => h.company.id)
  const { stockData } = useRealtimeStockData(companyIds)
  
  // 포트폴리오 데이터 실시간 업데이트
  const portfolio = initialPortfolio.map(holding => ({
    ...holding,
    company: {
      ...holding.company,
      ...stockData.get(holding.company.id)
    }
  }))

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
        <h2 className="text-2xl font-bold text-gray-100">내 자산</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          <motion.div 
            className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-6 border border-white/10"
            animate={{
              boxShadow: totalGain >= 0 
                ? '0 0 20px rgba(16, 185, 129, 0.2)' 
                : '0 0 20px rgba(239, 68, 68, 0.2)'
            }}
          >
            <p className="text-sm font-medium text-gray-400 mb-2">총 보유자산</p>
            <motion.div
              animate={{
                scale: [1, 1.02, 1],
                transition: { duration: 0.3 }
              }}
            >
              <motion.p
                key={totalValue}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-bold text-white mb-4"
              >
                {Math.floor(totalValue).toLocaleString()}원
              </motion.p>
            </motion.div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">보유 포인트</p>
                <p className="text-xl font-bold text-blue-400">
                  {Math.floor(points)?.toLocaleString() || 0} P
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">총 손익</p>
                <div className="flex items-center gap-2">
                  <p className={`text-xl font-bold ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.floor(totalGain).toLocaleString()}원
                  </p>
                  <span className={`flex items-center text-sm ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalGain >= 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                    {Math.abs(gainPercentage).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        
        <Button 
          className="w-full mt-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium py-2 rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          onClick={() => router.push('/dashboard/stock/portfolio')}
        >
          자세히 보기
        </Button>
      </CardContent>
    </>
  )
}
