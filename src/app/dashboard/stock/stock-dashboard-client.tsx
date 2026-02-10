'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { MarketOverview } from './components/market-overview'
import { PortfolioSummary } from './components/portfolio-summary'
import { StockList } from './components/stock-list'
import { NewsTicker } from './components/news-ticker'
import { Card } from '@/components/ui/card'
import DashboardBackButton from '@/components/DashboardBackButton'
import { MarketTimer } from './components/market-timer'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'
// SectorTrends는 MarketTimer에 통합됨

const PortfolioDiversification = dynamic(
  () => import('./components/portfolio-diversification').then(mod => mod.PortfolioDiversification),
  { ssr: false }
)

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
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>
      
      {/* 컴팩트 헤더 */}
      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">
            STACKS
          </p>
          <h1 className="text-2xl font-bold text-gray-100">
            주식 시뮬레이션
          </h1>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          {/* 상단 2행 통합 그리드 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 포트폴리오 요약 (1행, 왼쪽 넓게) */}
            <Card className="lg:col-span-8 rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 overflow-hidden">
              <PortfolioSummary portfolio={portfolio} points={points} />
            </Card>

            {/* 마켓 타이머 + 섹터 트렌드 (1~2행 관통, 오른쪽 사이드바) */}
            <Card className="lg:col-span-4 lg:row-span-2 rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 overflow-hidden">
              <MarketTimer />
            </Card>
            
            {/* 시장 개요 (2행, 왼쪽) */}
            <Card className="lg:col-span-4 rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 overflow-hidden">
              <MarketOverview companies={companies} />
            </Card>

            {/* 포트폴리오 다각화 (2행, 왼쪽 중앙) */}
            <Card className="lg:col-span-4 rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 overflow-hidden">
              <PortfolioDiversification
                portfolio={portfolio}
                availableSectors={[...new Set(companies.map((c) => c.industry))]}
              />
            </Card>
          </div>

          {/* 뉴스 티커 */}
          <Card className="mt-4 rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 overflow-hidden">
            <NewsTicker news={initialNews} />
          </Card>
          
          {/* 주식 목록 */}
          <Card className="mt-4 rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 overflow-hidden">
            <StockList companies={companies} />
          </Card>
        </div>
      </section>
    </div>
  )
}
