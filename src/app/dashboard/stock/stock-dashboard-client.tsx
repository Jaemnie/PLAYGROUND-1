'use client'

import { useState, useEffect } from 'react'
import { MarketOverview } from './components/market-overview'
import { PortfolioSummary } from './components/portfolio-summary'
import { StockList } from './components/stock-list'
import { NewsTicker } from './components/news-ticker'
import { Card } from '@/components/ui/card'
import { BackButton } from '@/components/back-button'
import { MarketTimer } from './components/market-timer'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'
import { createClientBrowser } from '@/lib/supabase/client'

interface StockDashboardClientProps {
  user: any
  initialPortfolio: any[]
  initialCompanies: any[]
  initialNews: any[]
  points: number
}

export function StockDashboardClient({
  user,
  initialPortfolio,
  initialCompanies,
  initialNews,
  points
}: StockDashboardClientProps) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [portfolio, setPortfolio] = useState(initialPortfolio)
  const [news, setNews] = useState(initialNews)
  
  // 모든 회사의 ID를 추출하여 실시간 데이터 구독
  const companyIds = [...initialCompanies.map(c => c.id), ...initialPortfolio.map(h => h.company.id)]
  const { stockData } = useRealtimeStockData(companyIds)
  
  // 실시간 데이터로 companies와 portfolio 상태 업데이트
  useEffect(() => {
    const updatedCompanies = companies.map(company => ({
      ...company,
      ...stockData.get(company.id)
    }))
    setCompanies(updatedCompanies)

    const updatedPortfolio = portfolio.map(holding => ({
      ...holding,
      company: {
        ...holding.company,
        ...stockData.get(holding.company.id)
      }
    }))
    setPortfolio(updatedPortfolio)
  }, [stockData])

  // 실시간 뉴스 구독
  useEffect(() => {
    const supabase = createClientBrowser()
    const channelName = `news-${Date.now()}`
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'news'
        },
        (payload) => {
          setNews(prev => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-x-hidden">
      <div className="fixed top-4 left-4 z-50">
        <BackButton />
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">주식 시뮬레이션</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 포트폴리오 요약 */}
          <Card className="lg:col-span-2 bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
            <PortfolioSummary portfolio={portfolio} points={points} />
          </Card>
          
          <div className="space-y-6">
            {/* 마켓 타이머 */}
            <Card className="bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
              <MarketTimer />
            </Card>
            
            {/* 시장 개요 */}
            <Card className="bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
              <MarketOverview companies={companies} />
            </Card>
          </div>
        </div>
        
        {/* 뉴스 티커 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
          <NewsTicker news={news} />
        </Card>
        
        {/* 주식 목록 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
          <StockList companies={companies} />
        </Card>
      </div>
    </div>
  )
}
