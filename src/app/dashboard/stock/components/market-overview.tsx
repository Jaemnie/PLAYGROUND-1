'use client'

import { useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeStockData } from '@/hooks/useRealtimeStockData'

interface MarketOverviewProps {
  companies: {
    id: string
    name: string
    ticker: string
    current_price: number
    last_closing_price: number
  }[]
}

export function MarketOverview({ companies: initialCompanies }: MarketOverviewProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({
    key: 'priceChange',
    direction: 'desc'
  })
  const itemsPerPage = 3
  
  const companyIds = initialCompanies.map(c => c.id)
  const { stockData, changes } = useRealtimeStockData(companyIds)
  
  // 실시간 데이터로 업데이트 및 변동폭 계산
  const companies = initialCompanies.map(company => {
    const currentPrice = stockData.get(company.id)?.current_price || company.current_price
    const lastClosingPrice = company.last_closing_price
    const priceChangePercent = ((currentPrice - lastClosingPrice) / lastClosingPrice) * 100

    return {
      ...company,
      ...stockData.get(company.id),
      priceChangePercent
    }
  })

  // 변동폭 기준 정렬
  const sortedCompanies = [...companies].sort((a, b) => {
    const aChange = Math.abs(a.priceChangePercent)
    const bChange = Math.abs(b.priceChangePercent)
    return sortConfig.direction === 'desc' ? bChange - aChange : aChange - bChange
  })
  
  const totalPages = Math.ceil(sortedCompanies.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const displayedCompanies = sortedCompanies.slice(startIndex, startIndex + itemsPerPage)

  const toggleSortDirection = () => {
    setSortConfig(prev => ({
      ...prev,
      direction: prev.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            시장 동향
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSortDirection}
            className="text-gray-400 hover:text-blue-400"
          >
            {sortConfig.direction === 'desc' ? '변동폭 ↓' : '변동폭 ↑'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 h-[280px] overflow-hidden">
          <AnimatePresence mode="popLayout">
            {displayedCompanies.map((company, index) => {
              const currentPrice = company.current_price
              const lastClosingPrice = company.last_closing_price
              const priceChangePercent = ((currentPrice - lastClosingPrice) / lastClosingPrice) * 100
              const isPriceUp = priceChangePercent > 0

              return (
                <motion.div
                  key={`${company.id}-${currentPage}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`font-medium ${isPriceUp ? 'text-green-500' : 'text-red-500'}`}>
                        {company.name}
                      </p>
                      <p className="text-sm text-gray-400">{company.ticker}</p>
                    </div>
                    <div className="text-right">
                      <div className={`inline-block px-2 py-1 rounded ${
                        isPriceUp ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}>
                        <p className="font-medium text-gray-100">
                          {Math.floor(company.current_price).toLocaleString()}원
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        {isPriceUp ? (
                          <ArrowUpIcon className="w-3 h-3 text-green-500" />
                        ) : (
                          <ArrowDownIcon className="w-3 h-3 text-red-500" />
                        )}
                        <span className={`text-sm ${isPriceUp ? 'text-green-500' : 'text-red-500'}`}>
                          {Math.abs(priceChangePercent).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <div className="flex justify-between items-center mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="border-gray-700 text-gray-400 hover:bg-gray-800"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-400">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="border-gray-700 text-gray-400 hover:bg-gray-800"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </>
  )
}
