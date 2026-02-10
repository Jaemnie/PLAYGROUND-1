'use client'

import { Card } from '@/components/ui/card'
import StockBackButton from '@/components/StockBackButton'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { QuickTradeModal } from '@/components/ui/quick-trade-modal'
import HoldingsTable from './components/holdings-table'
import TransactionHistory from './components/transaction-history'
import PendingOrders from './components/pending-orders'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'
import { createClientBrowser } from '@/lib/supabase/client'

const PortfolioOverview = dynamic(
  () => import('./components/portfolio-overview'),
  { ssr: false }
)

interface User {
  id: string;
  username: string;
}

interface Company {
  id: string;
  name: string;
  ticker: string;
  current_price: number;
  last_closing_price: number;
}

interface PortfolioItem {
  company: Company;
  quantity: number;
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

// 회사별 잠긴 주식 수량 (조건 매도 주문 에스크로)
export type LockedSharesMap = Map<string, number>

interface PortfolioClientProps {
  user: User;
  portfolio: PortfolioItem[];
  transactions: Transaction[];
  points: number;
  themeCompanyIds?: string[];
}

export function PortfolioClient({ user, portfolio: initialPortfolio, transactions: initialTransactions, points: initialPoints, themeCompanyIds = [] }: PortfolioClientProps) {
  const [portfolio, setPortfolio] = useState(initialPortfolio)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [points, setPoints] = useState(initialPoints)
  const [selectedHolding, setSelectedHolding] = useState<typeof initialPortfolio[number] | null>(null)
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [lockedShares, setLockedShares] = useState<LockedSharesMap>(new Map())

  const allIds = portfolio.map(h => h.company.id)
  const companyIds = themeCompanyIds.length > 0 ? allIds.filter(id => themeCompanyIds.includes(id)) : allIds
  const { stockData } = useRealtimeStockData(companyIds)
  
  // 포트폴리오 데이터 실시간 업데이트
  const updatedPortfolio = portfolio.map(holding => ({
    ...holding,
    company: {
      ...holding.company,
      ...stockData.get(holding.company.id)
    }
  }))

  // 조건 매도 주문의 잠긴 주식 수량 조회
  const fetchLockedShares = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock/pending-orders?user_id=${user.id}&status=pending`)
      const data = await res.json()
      if (data.orders) {
        const map = new Map<string, number>()
        for (const order of data.orders) {
          if (order.order_type === 'sell') {
            const current = map.get(order.company_id) || 0
            map.set(order.company_id, current + order.shares)
          }
        }
        setLockedShares(map)
      }
    } catch {
      // 조회 실패해도 무시 (잠김 표시만 안 됨)
    }
  }, [user.id])

  useEffect(() => {
    fetchLockedShares()
  }, [fetchLockedShares])

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
    
    // 잠긴 주식도 갱신
    await fetchLockedShares()
  }

  const handleTradeComplete = async (): Promise<void> => {
    setShowTradeModal(false)
    await refreshData()
  }

  return (
    <div className="min-h-screen bg-background">
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

      {/* 컴팩트 헤더 */}
      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">
            STACKS
          </p>
          <h1 className="text-2xl font-bold text-gray-100">
            포트폴리오
          </h1>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
            <PortfolioOverview user={user} portfolio={updatedPortfolio} points={points} lockedShares={lockedShares} />
          </Card>
          
          <div className="mt-4">
            <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
              <HoldingsTable 
                portfolio={updatedPortfolio} 
                user={user}
                points={points}
                lockedShares={lockedShares}
                onTradeClick={(holding) => {
                  setSelectedHolding(holding)
                  setShowTradeModal(true)
                }}
              />
            </Card>
          </div>

          <div className="mt-4">
            <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
              <PendingOrders userId={user.id} onOrderChange={refreshData} />
            </Card>
          </div>

          <div className="mt-4">
            <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
              <TransactionHistory transactions={transactions} />
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}

export default PortfolioClient
