'use client'

import { Card } from '@/components/ui/card'
import StockBackButton from '@/components/StockBackButton'
import { useState } from 'react'
import { QuickTradeModal } from '@/components/ui/quick-trade-modal'
import HoldingsTable from './components/holdings-table'
import PerformanceChart from './components/performance-chart'
import TransactionHistory from './components/transaction-history'
import PortfolioAnalysis from './components/portfolio-analysis'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'
import { createClientBrowser } from '@/lib/supabase/client'

interface User {
  id: string;
  username: string;
  // 필요한 추가 필드들
}

interface Company {
  id: string;
  name: string;
  ticker: string;
  current_price: number;
  last_closing_price: number;
  // 필요한 추가 필드들
}

interface PortfolioItem {
  company: Company;
  quantity: number;
  // 필요한 추가 필드들
}

interface Transaction {
  id: string;
  transaction_type: 'buy' | 'sell';
  shares: number;
  total_amount: number;
  price: number;
  created_at: string;
  company: Company;
}

interface PortfolioClientProps {
  user: User;
  portfolio: PortfolioItem[];
  transactions: Transaction[];
  points: number;
}

export function PortfolioClient({ user, portfolio: initialPortfolio, transactions: initialTransactions, points: initialPoints }: PortfolioClientProps) {
  const [portfolio, setPortfolio] = useState(initialPortfolio)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [points, setPoints] = useState(initialPoints)
  const [selectedHolding, setSelectedHolding] = useState<typeof initialPortfolio[number] | null>(null)
  const [showTradeModal, setShowTradeModal] = useState(false)

  // 실시간 주식 데이터 구독
  const companyIds = portfolio.map(h => h.company.id)
  const { stockData } = useRealtimeStockData(companyIds)
  
  // 포트폴리오 데이터 실시간 업데이트
  const updatedPortfolio = portfolio.map(holding => ({
    ...holding,
    company: {
      ...holding.company,
      ...stockData.get(holding.company.id)
    }
  }))

  const refreshData = async (): Promise<void> => {
    const supabase = createClientBrowser()

    const [holdingsResult, transactionsResult, profileResult] = await Promise.all([
      supabase
        .from('holdings')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('user_id', user.id),
      
      supabase
        .from('transactions')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      
      supabase
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single()
    ])

    if (holdingsResult.data) setPortfolio(holdingsResult.data)
    if (transactionsResult.data) setTransactions(transactionsResult.data)
    if (profileResult.data) setPoints(profileResult.data.points)
  }

  const handleTradeComplete = async (): Promise<void> => {
    setShowTradeModal(false)
    await refreshData()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {selectedHolding && (
        <QuickTradeModal 
          isOpen={showTradeModal}
          onClose={() => setShowTradeModal(false)}
          company={selectedHolding.company}
          user={user}
          points={points}
          holding={selectedHolding}
          onTradeComplete={handleTradeComplete}
        />
      )}
      
      <div className="fixed top-4 left-4 z-50">
        <StockBackButton />
      </div>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">포트폴리오</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <PortfolioAnalysis 
              portfolio={updatedPortfolio} 
              points={points}
              user={user}
            />
          </Card>
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <PerformanceChart 
              portfolio={updatedPortfolio} 
              user={user}
            />
          </Card>
        </div>
        
        <div className="mt-6">
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <HoldingsTable 
              portfolio={updatedPortfolio} 
              user={user}
              points={points}
              onTradeClick={(holding) => {
                setSelectedHolding(holding)
                setShowTradeModal(true)
              }}
            />
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
