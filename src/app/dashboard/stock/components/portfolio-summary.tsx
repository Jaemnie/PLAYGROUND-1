'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowUpIcon, ArrowDownIcon, ChartBarIcon, WalletIcon, BanknotesIcon } from '@heroicons/react/24/outline'
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
  
  const portfolio = initialPortfolio.map(holding => ({
    ...holding,
    company: {
      ...holding.company,
      ...stockData.get(holding.company.id)
    }
  }))

  useEffect(() => {
    const value = portfolio.reduce((sum, holding) => {
      return sum + (holding.shares * holding.company.current_price)
    }, 0)
    
    const gain = portfolio.reduce((sum, holding) => {
      const currentValue = holding.shares * holding.company.current_price
      const costBasis = holding.shares * holding.average_cost
      return sum + (currentValue - costBasis)
    }, 0)
    
    setTotalValue(value)
    setTotalGain(gain)
    setGainPercentage(value === 0 ? 0 : (gain / value) * 100)
  }, [portfolio])

  return (
    <>
      <CardHeader>
        <h2 className="text-2xl font-bold text-gray-100">자산 현황</h2>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-3">
          <motion.div 
            className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <WalletIcon className="w-4 h-4 text-blue-400" />
                  <p className="text-sm font-medium text-gray-400">총 보유자산</p>
                </div>
                <motion.p
                  key={totalValue}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-2xl font-bold text-white"
                >
                  {Math.floor(totalValue).toLocaleString()}
                  <span className="text-base text-gray-400 ml-1">원</span>
                </motion.p>
              </div>
              
              <Button 
                size="sm"
                variant="outline"
                className="border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
                onClick={() => router.push('/dashboard/stock/portfolio')}
              >
                상세보기
              </Button>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-2 mb-1">
                <BanknotesIcon className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-gray-400">보유 포인트</p>
              </div>
              <p className="text-lg font-bold text-blue-400">
                {Math.floor(points)?.toLocaleString()} P
              </p>
            </div>
            
            <div className="p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-2 mb-1">
                <ChartBarIcon className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-400">총 손익</p>
              </div>
              <div className="flex items-center gap-1">
                <p className={`text-lg font-bold ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {Math.floor(totalGain).toLocaleString()}원
                </p>
                <span className={`text-xs ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ({Math.abs(gainPercentage).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  )
}
