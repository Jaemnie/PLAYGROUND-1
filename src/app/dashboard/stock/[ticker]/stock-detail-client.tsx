'use client'

import { useState } from 'react'
import { CompanyInfo } from './components/company-info'
import { PriceChart } from './components/price-chart'
import { TradingForm } from './components/trading-form'
import { OrderBook } from './components/order-book'
import { Card } from '@/components/ui/card'
import { BackButton } from '@/components/back-button'

interface StockDetailClientProps {
  user: any
  company: any
  holding: any
  points: number
}

export function StockDetailClient({
  user,
  company,
  holding,
  points
}: StockDetailClientProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="fixed top-4 left-4 z-50">
        <BackButton />
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 기업 정보 */}
          <Card className="lg:col-span-2 bg-black/40 backdrop-blur-sm border-gray-800">
            <CompanyInfo company={company} holding={holding} />
          </Card>
          
          {/* 주문 양식 */}
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <TradingForm 
              user={user}
              company={company}
              holding={holding}
              points={points}
            />
          </Card>
        </div>
        
        {/* 가격 차트 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800">
          <PriceChart 
            company={company}
            timeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
          />
        </Card>
        
        {/* 호가창 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800">
          <OrderBook company={company} />
        </Card>
      </div>
    </div>
  )
} 