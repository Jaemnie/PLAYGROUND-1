'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'
import { toast } from 'sonner'
import { createClientBrowser } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  ticker: string
  current_price: number
  last_closing_price: number
  market_cap: number
  is_delisted?: boolean
  industry: string
}

interface StockListProps {
  companies: Company[]
}

// 가격 변동 애니메이션을 위한 컴포넌트
function PriceCell({ 
  currentPrice, 
  lastClosingPrice, 
  isChanged 
}: { 
  currentPrice: number
  lastClosingPrice: number
  isChanged: boolean
}) {
  const isPriceUp = currentPrice > lastClosingPrice
  const priceColor = isPriceUp ? 'text-green-500' : currentPrice < lastClosingPrice ? 'text-red-500' : 'text-gray-400'

  return (
    <div className="text-right relative">
      <motion.div 
        className={`inline-flex items-center gap-1 px-2 py-1 rounded overflow-hidden relative
          ${isPriceUp ? 'bg-green-500/10' : currentPrice < lastClosingPrice ? 'bg-red-500/10' : 'bg-gray-500/10'}`}
        animate={isChanged ? {
          scale: [1, 1.02, 1],
        } : {}}
        transition={{ 
          duration: 0.3,
          ease: [0.32, 0.72, 0, 1]
        }}
      >
        {currentPrice > lastClosingPrice ? (
          <ChevronUpIcon className="w-4 h-4 text-green-500" />
        ) : currentPrice < lastClosingPrice ? (
          <ChevronDownIcon className="w-4 h-4 text-red-500" />
        ) : (
          <span className="w-4 h-4" />
        )}
        <span className={`${priceColor} relative z-10`}>
          {Math.floor(currentPrice).toLocaleString()}원
        </span>
      </motion.div>
    </div>
  )
}

export function StockList({ companies: initialCompanies }: StockListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({
    key: 'market_cap',
    direction: 'desc'
  })
  const [animatingPrices, setAnimatingPrices] = useState<Set<string>>(new Set())

  const companyIds = initialCompanies.map(c => c.id)
  const { stockData, changes } = useRealtimeStockData(companyIds)
  
  // 실시간 데이터와 결합
  const companies = initialCompanies.map(company => ({
    ...company,
    ...stockData.get(company.id)
  }))

  // 검색 필터링
  const filteredCompanies = companies.filter(company => 
    company.name.toLowerCase().includes(search.toLowerCase()) ||
    company.ticker.toLowerCase().includes(search.toLowerCase())
  )

  // 정렬
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    const key = sortConfig.key as keyof Company
    const aValue = a[key]
    const bValue = b[key]
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  useEffect(() => {
    if (changes.size > 0) {
      setAnimatingPrices(new Set<string>(changes as Iterable<string>))
      const timer = setTimeout(() => {
        setAnimatingPrices(new Set<string>())
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [changes])

  // 정렬 핸들러
  const requestSort = (key: keyof Company) => {
    setSortConfig(current => ({
      key,
      direction: 
        current.key === key && current.direction === 'asc' 
          ? 'desc' 
          : 'asc',
    }))
  }

  // 시가총액 포맷팅 함수
  const formatMarketCap = (marketCap: number) => {
    const trillion = 1_000_000_000_000
    const billion = 100_000_000
    const million = 10000

    if (marketCap >= trillion) {
      const trillionValue = Math.floor(marketCap / trillion)
      const billionValue = Math.floor((marketCap % trillion) / billion)
      if (billionValue > 0) {
        return `${trillionValue}조 ${billionValue}억`
      }
      return `${trillionValue}조`
    }

    if (marketCap >= billion) {
      const billionValue = Math.floor(marketCap / billion)
      const millionValue = Math.floor((marketCap % billion) / million)
      if (millionValue > 0) {
        return `${billionValue}억 ${millionValue}만`
      }
      return `${billionValue}억`
    }

    return marketCap.toString()
  }

  // 수정: 서버 사이드 페이징
  const fetchPage = async (page: number) => {
    const { data } = await createClientBrowser()
      .from('companies')
      .select('*')
      .range((page-1)*20, page*20-1);
    return data;
  };

  return (
    <>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            주식 목록
          </h2>
          <Input
            placeholder="기업명 또는 종목코드 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs bg-white/5 border-white/10 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-white/10 bg-white/5">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead 
                  className="cursor-pointer font-medium text-sm text-gray-400 hover:text-blue-400 transition-colors"
                  onClick={() => requestSort('name')}
                >
                  기업명
                </TableHead>
                <TableHead 
                  className="cursor-pointer font-medium text-sm text-gray-400 hover:text-blue-400 transition-colors"
                  onClick={() => requestSort('ticker')}
                >
                  종목코드
                </TableHead>
                <TableHead 
                  className="cursor-pointer font-medium text-sm text-gray-400 hover:text-blue-400 transition-colors"
                  onClick={() => requestSort('industry')}
                >
                  산업
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer font-medium text-sm text-gray-400 hover:text-blue-400 transition-colors"
                  onClick={() => requestSort('current_price')}
                >
                  현재가
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer font-medium text-sm text-gray-400 hover:text-blue-400 transition-colors"
                  onClick={() => requestSort('market_cap')}
                >
                  시가총액
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {sortedCompanies.map((company) => (
                  <motion.tr
                    key={company.id}
                    initial={{ opacity: 0.8 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className={`cursor-pointer border-white/10 hover:bg-white/5`}
                    onClick={() => {
                      if (company.is_delisted) {
                        toast.error('상장폐지 상태인 기업은 조회할 수 없습니다.')
                        return
                      }
                      router.push(`/dashboard/stock/${company.ticker}`)
                    }}
                  >
                    <TableCell>
                      <span className="text-white">
                        {company.name}
                        {company.is_delisted && (
                          <span className="ml-2 text-xs bg-red-500 text-white rounded px-1">
                            상장폐지
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-400">
                        {company.ticker}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-400">
                        {company.industry}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <PriceCell
                        currentPrice={company.current_price}
                        lastClosingPrice={company.last_closing_price}
                        isChanged={animatingPrices.has(company.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-gray-400">
                        {formatMarketCap(company.market_cap)}
                      </span>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </>
  )
}
