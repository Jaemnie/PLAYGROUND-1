'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CompanyInfo } from './components/company-info'
import { PriceChart } from './components/price-chart'
import { TradingForm } from './components/trading-form'
import { Card } from '@/components/ui/card'
import { BackButton } from '@/components/back-button'
import { TradeAlert } from '@/components/ui/trade-alert'

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
  const [showAlert, setShowAlert] = useState(false)
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const router = useRouter()

  useEffect(() => {
    if (company?.is_delisted) {
      toast.error('해당 기업은 상장폐지 상태입니다. 페이지를 조회할 수 없습니다.')
      router.push('/dashboard') // 대시보드나 목록 페이지로 리다이렉트
    }
  }, [company, router])

  const handleTradeComplete = (type: 'buy' | 'sell') => {
    setTradeType(type)
    setShowAlert(true)
    setTimeout(() => setShowAlert(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <TradeAlert 
        isOpen={showAlert} 
        type={tradeType} 
        onClose={() => setShowAlert(false)} 
      />
      
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
              onTradeComplete={handleTradeComplete}
            />
          </Card>
        </div>
        
        {/* 가격 차트 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800">
          <PriceChart 
            company={company}
            timeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
            formatPrice={(value: number) => Math.round(value).toString()}
          />
        </Card>
      </div>
    </div>
  )
} 