'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'

interface Company {
  id: string
  name: string
  ticker: string
  current_price: number
  last_closing_price: number
  market_cap: number
}

interface StockListProps {
  companies: Company[]
}

export function StockList({ companies: initialCompanies }: StockListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({
    key: 'market_cap',
    direction: 'desc'
  })

  const companyIds = initialCompanies.map(c => c.id)
  const { stockData, changes } = useRealtimeStockData(companyIds)
  
  // companies 데이터를 실시간 데이터로 업데이트
  const companies = initialCompanies.map(company => ({
    ...company,
    ...stockData.get(company.id)
  }))

  // 검색 필터링
  const filteredCompanies = companies.filter(company => 
    company.name.toLowerCase().includes(search.toLowerCase()) ||
    company.ticker.toLowerCase().includes(search.toLowerCase())
  )

  // 정렬 로직
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    const key = sortConfig.key as keyof Company
    const aValue = a[key]
    const bValue = b[key]
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  // 가격 변동 스타일
  const getPriceChangeStyle = (current: number, lastClose: number) => {
    const change = ((current - lastClose) / lastClose) * 100
    if (change > 0) return 'text-green-500'
    if (change < 0) return 'text-red-500'
    return 'text-gray-400'
  }

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

  // 시가총액 포맷팅 함수 추가
  const formatMarketCap = (marketCap: number) => {
    const trillion = 1_000_000_000_000; // 1조
    const billion = 100_000_000; // 1억
    const million = 10000; // 1만

    if (marketCap >= trillion) {
      const trillionValue = Math.floor(marketCap / trillion);
      const billionValue = Math.floor((marketCap % trillion) / billion);
      if (billionValue > 0) {
        return `${trillionValue}조 ${billionValue}억`;
      }
      return `${trillionValue}조`;
    }

    if (marketCap >= billion) {
      const billionValue = Math.floor(marketCap / billion);
      const millionValue = Math.floor((marketCap % billion) / million);
      if (millionValue > 0) {
        return `${billionValue}억 ${millionValue}만`;
      }
      return `${billionValue}억`;
    }

    if (marketCap >= million) {
      const millionValue = Math.floor(marketCap / million);
      return `${millionValue}만`;
    }

    return `${marketCap.toLocaleString()}`;
  }

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
                {sortedCompanies.map((company) => {
                  const priceChange = changes.get(company.id) || 0
                  const isPositive = priceChange > 0
                  
                  return (
                    <motion.tr
                      key={company.id}
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0.8 }}
                      transition={{ duration: 0.3 }}
                      className={`cursor-pointer border-white/10 hover:bg-white/5`}
                      onClick={() => router.push(`/dashboard/stock/${company.ticker}`)}
                    >
                      <TableCell>
                        <span className="text-white">
                          {company.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-400">
                          {company.ticker}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
                          company.current_price > company.last_closing_price 
                            ? 'bg-green-500/10' 
                            : company.current_price < company.last_closing_price 
                              ? 'bg-red-500/10'
                              : 'bg-gray-500/10'
                        }`}>
                          {company.current_price > company.last_closing_price ? (
                            <ChevronUpIcon className="w-4 h-4 text-green-500" />
                          ) : company.current_price < company.last_closing_price ? (
                            <ChevronDownIcon className="w-4 h-4 text-red-500" />
                          ) : (
                            <span className="w-4 h-4" />
                          )}
                          <span className={getPriceChangeStyle(
                            company.current_price,
                            company.last_closing_price
                          )}>
                            {Math.floor(company.current_price).toLocaleString()}원
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-gray-400">
                          {formatMarketCap(company.market_cap)}
                        </span>
                      </TableCell>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </>
  )
}
