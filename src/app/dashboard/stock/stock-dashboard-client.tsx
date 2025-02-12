'use client'

import { useState, useEffect } from 'react'
import { MarketOverview } from './components/market-overview'
import { PortfolioSummary } from './components/portfolio-summary'
import { StockList } from './components/stock-list'
import { NewsTicker } from './components/news-ticker'
import { Card } from '@/components/ui/card'
import { DashboardDashboardBackButton } from '@/components/back-button'
import { MarketTimer } from './components/market-timer'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'
import { PortfolioDiversification } from './components/portfolio-diversification'

interface User {
  id: string;
  name: string;
  // 추가 필드
}

interface Company {
  id: string;
  name: string;
  ticker: string;
  current_price: number;
  last_closing_price: number;
  market_cap: number;
  industry: string;
  // 추가 필드
}

interface PortfolioItem {
  company: Company;
  quantity: number;
  // 추가 필드
}

interface News {
  id: string;
  title: string;
  content: string;
  published_at: string;
  impact: "positive" | "negative" | "neutral";
  related_company_id?: string;
}

interface StockDashboardClientProps {
  user: User;
  initialPortfolio: PortfolioItem[];
  initialCompanies: Company[];
  initialNews: News[];
  points: number;
}

export function StockDashboardClient({
  initialPortfolio,
  initialCompanies,
  initialNews,
  points
}: StockDashboardClientProps) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [portfolio, setPortfolio] = useState(initialPortfolio)
  
  // 모든 회사의 ID를 추출하여 실시간 데이터 구독
  const companyIds = [...initialCompanies.map(c => c.id), ...initialPortfolio.map(h => h.company.id)]
  const { stockData } = useRealtimeStockData(companyIds)
  
  // 실시간 데이터로 companies와 portfolio 상태 업데이트 (함수형 업데이트 사용)
  useEffect(() => {
    setCompanies(prevCompanies =>
      prevCompanies.map(company => ({
        ...company,
        ...stockData.get(company.id)
      }))
    )
    setPortfolio(prevPortfolio =>
      prevPortfolio.map(holding => ({
        ...holding,
        company: {
          ...holding.company,
          ...stockData.get(holding.company.id)
        }
      }))
    )
  }, [stockData])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-x-hidden">
      <div className="fixed top-4 left-4 z-50">
        <DashboardDashboardBackButton />
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">주식 시뮬레이션</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 포트폴리오 요약 */}
          <Card className="lg:col-span-5 bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
            <PortfolioSummary portfolio={portfolio} points={points} />
          </Card>

          {/* 마켓 타이머 */}
          <Card className="lg:col-span-3 bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
            <MarketTimer />
          </Card>
          
          {/* 시장 개요 */}
          <Card className="lg:col-span-4 bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
            <MarketOverview companies={companies} />
          </Card>
        </div>

        {/* 포트폴리오 다각화 분석 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
          <PortfolioDiversification portfolio={portfolio} />
        </Card>
        
        {/* 뉴스 티커 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
          <NewsTicker news={initialNews} />
        </Card>
        
        {/* 주식 목록 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800 overflow-hidden">
          <StockList companies={companies} />
        </Card>
      </div>
    </div>
  )
}
