'use client'

import { useState } from 'react'
import { MarketOverview } from './components/market-overview'
import { PortfolioSummary } from './components/portfolio-summary'
import { StockList } from './components/stock-list'
import { NewsTicker } from './components/news-ticker'
import { Card } from '@/components/ui/card'
import { BackButton } from '@/components/back-button'

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
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="fixed top-4 left-4 z-50">
        <BackButton />
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">주식 시뮬레이션</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 포트폴리오 요약 */}
          <Card className="lg:col-span-2 bg-black/40 backdrop-blur-sm border-gray-800">
            <PortfolioSummary portfolio={initialPortfolio} points={points} />
          </Card>
          
          {/* 시장 개요 */}
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <MarketOverview companies={initialCompanies} />
          </Card>
        </div>
        
        {/* 뉴스 티커 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800">
          <NewsTicker news={initialNews} />
        </Card>
        
        {/* 주식 목록 */}
        <Card className="mt-6 bg-black/40 backdrop-blur-sm border-gray-800">
          <StockList companies={initialCompanies} />
        </Card>
      </div>
    </div>
  )
}
