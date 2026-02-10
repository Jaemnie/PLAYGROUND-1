'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CompanyInfo } from './components/company-info'
import { PriceChart } from './components/price-chart'
import { TradingForm } from './components/trading-form'
import { Card } from '@/components/ui/card'
import StockBackButton from '@/components/StockBackButton'
import { TradeAlert } from '@/components/ui/trade-alert'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'
import { createClientBrowser } from '@/lib/supabase/client'
import { CompanyNews } from './components/company-news'

interface User {
  id: string;
  name: string;
  // 필요한 추가 필드들
}

interface Company {
  id: string;
  name: string;
  ticker: string;
  current_price: number;
  is_delisted?: boolean;
  // 필요한 추가 필드들
}

interface Holding {
  id: string;
  shares: number;
  // 필요한 추가 필드들
}

interface StockDetailClientProps {
  user: User;
  company: Company;
  holding: Holding | null;
  points: number;
  companyNews: {
    id: string;
    title: string;
    content: string;
    published_at: string;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
}

export function StockDetailClient({
  user,
  company: initialCompany,
  holding: initialHolding,
  points: initialPoints,
  companyNews
}: StockDetailClientProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('5M')
  const [showAlert, setShowAlert] = useState(false)
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [points, setPoints] = useState(initialPoints)
  const [holding, setHolding] = useState(initialHolding)
  const router = useRouter()

  // 실시간 주식 데이터 구독
  const { stockData } = useRealtimeStockData([initialCompany.id])
  
  // 실시간 데이터로 company 업데이트 (useMemo 사용)
  const company = useMemo(() => ({
    ...initialCompany,
    ...stockData.get(initialCompany.id)
  }), [initialCompany, stockData])

  const refreshData = async (): Promise<void> => {
    const supabase = createClientBrowser()

    const [holdingResult, profileResult] = await Promise.all([
      // 보유 주식 정보 업데이트
      supabase
        .from('holdings')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .maybeSingle(),
      
      // 포인트 정보 업데이트
      supabase
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single()
    ])

    if (holdingResult.data) {
      setHolding(holdingResult.data)
    } else {
      setHolding(null)
    }
    
    if (profileResult.data) {
      setPoints(profileResult.data.points)
    }
  }

  useEffect(() => {
    if (company?.is_delisted) {
      toast.error('해당 기업은 상장폐지 상태입니다. 페이지를 조회할 수 없습니다.')
      router.push('/dashboard')
    }
  }, [company, router])

  const handleTradeComplete = async (type: 'buy' | 'sell'): Promise<void> => {
    setTradeType(type)
    setShowAlert(true)
    await refreshData()
    setTimeout(() => setShowAlert(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background">
      <TradeAlert 
        isOpen={showAlert} 
        type={tradeType} 
        onClose={() => setShowAlert(false)} 
      />
      
      <div className="fixed top-4 left-4 z-50">
        <StockBackButton />
      </div>
      
      {/* 컴팩트 헤더 */}
      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">
            STACKS
          </p>
          <h1 className="text-2xl font-bold text-gray-100">
            {company.name} ({company.ticker})
          </h1>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 기업 정보 */}
            <Card className="lg:col-span-2 rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
              <CompanyInfo company={company} holding={holding} />
            </Card>
            
            {/* 주문 양식 */}
            <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
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
          <Card className="mt-4 rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
            <PriceChart 
              company={company}
              timeframe={selectedTimeframe}
              onTimeframeChange={setSelectedTimeframe}
            />
          </Card>

          {/* 기업 뉴스 */}
          <Card className="mt-4 rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
            <CompanyNews 
              companyId={company.id}
              ticker={company.ticker}
              initialNews={companyNews}
            />
          </Card>
        </div>
      </section>
    </div>
  )
} 