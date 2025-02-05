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
    previous_price: number
  }[]
}

export function MarketOverview({ companies: initialCompanies }: MarketOverviewProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  
  const companyIds = initialCompanies.map(c => c.id)
  const { stockData, changes } = useRealtimeStockData(companyIds)
  
  // 실시간 데이터로 업데이트
  const companies = initialCompanies.map(company => ({
    ...company,
    ...stockData.get(company.id)
  }))
  
  const totalPages = Math.ceil(companies.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const displayedCompanies = companies.slice(startIndex, startIndex + itemsPerPage)

  return (
    <>
      <CardHeader>
        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          시장 동향
        </h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {displayedCompanies.map((company) => {
              const currentPrice = company.current_price
              const previousPrice = company.previous_price
              const priceChangePercent = ((currentPrice - previousPrice) / previousPrice) * 100
              const isPriceUp = priceChangePercent > 0

              return (
                <motion.div
                  key={company.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <motion.p 
                        className="font-medium text-gray-100"
                        animate={{
                          color: priceChangePercent !== 0 
                            ? isPriceUp ? '#10B981' : '#EF4444'
                            : '#E5E7EB',
                          transition: { duration: 0.3 }
                        }}
                      >
                        {company.name}
                      </motion.p>
                      <p className="text-sm text-gray-400">{company.ticker}</p>
                    </div>
                    <div className="text-right">
                      <motion.div
                        initial={false}
                        animate={{
                          backgroundColor: priceChangePercent !== 0
                            ? isPriceUp 
                              ? 'rgba(16, 185, 129, 0.1)'
                              : 'rgba(239, 68, 68, 0.1)'
                            : 'transparent'
                        }}
                        className="inline-block px-2 py-1 rounded"
                      >
                        <motion.p
                          key={company.current_price}
                          initial={{ y: -20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="font-medium text-gray-100"
                        >
                          {Math.floor(company.current_price).toLocaleString()}원
                        </motion.p>
                      </motion.div>
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
