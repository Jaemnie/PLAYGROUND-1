'use client'

import { Card } from '@/components/ui/card'
import { BackButton } from '@/components/back-button'
import HoldingsTable from './components/holdings-table'
import PerformanceChart from './components/performance-chart'
import TransactionHistory from './components/transaction-history'
import PortfolioAnalysis from './components/portfolio-analysis'

interface PortfolioClientProps {
  user: any
  portfolio: any[]
  transactions: any[]
  points: number
}

export function PortfolioClient({ user, portfolio, transactions, points }: PortfolioClientProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="fixed top-4 left-4 z-50">
        <BackButton />
      </div>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">포트폴리오</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <PortfolioAnalysis portfolio={portfolio} points={points} />
          </Card>
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <PerformanceChart portfolio={portfolio} />
          </Card>
        </div>
        
        <div className="mt-6">
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <HoldingsTable portfolio={portfolio} />
          </Card>
        </div>

        <div className="mt-6">
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <TransactionHistory transactions={transactions} />
          </Card>
        </div>
      </div>
    </div>
  )
}

export default PortfolioClient
