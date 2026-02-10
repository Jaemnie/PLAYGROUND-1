'use client'

import { format } from 'date-fns'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'

interface Transaction {
  id: string
  transaction_type: string
  shares: number
  price: number
  total_amount: number
  created_at: string
  company: {
    name: string
    id: string
    ticker: string
    current_price: number
    logo_url?: string
  }
}

interface TransactionHistoryProps {
  transactions: Transaction[]
}

type Filter = 'all' | 'buy' | 'sell'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'buy', label: '매수' },
  { key: 'sell', label: '매도' },
]

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState<Filter>('all')
  const itemsPerPage = 10

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter(tx => tx.transaction_type === filter)

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const displayedTransactions = filtered.slice(startIndex, startIndex + itemsPerPage)

  const handleFilterChange = (f: Filter) => {
    setFilter(f)
    setCurrentPage(1)
  }

  return (
    <div className="p-6">
      {/* 헤더 - 클릭으로 토글 */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-semibold text-gray-100">거래 내역</h2>
          <span className="text-xs text-gray-500">{transactions.length}건</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
        </motion.div>
      </button>

      {/* 펼쳐지는 본문 */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* 필터 탭 */}
            <div className="flex items-center justify-between mt-5 mb-3">
              <div className="flex bg-white/5 rounded-lg p-0.5">
                {FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleFilterChange(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      filter === key
                        ? 'bg-white/10 text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {filtered.length}건
              </span>
            </div>

            {/* 거래 리스트 */}
            <div className="bg-black/20 rounded-2xl backdrop-blur-sm border border-white/5">
              <AnimatePresence mode="popLayout">
                {displayedTransactions.map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`
                      p-4 flex items-center justify-between
                      ${index !== displayedTransactions.length - 1 ? 'border-b border-white/5' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`
                        text-[11px] font-medium px-1.5 py-0.5 rounded
                        ${tx.transaction_type === 'buy' 
                          ? 'bg-blue-500/10 text-blue-400' 
                          : 'bg-red-500/10 text-red-400'}
                      `}>
                        {tx.transaction_type === 'buy' ? '매수' : '매도'}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm text-gray-100">{tx.company.name}</span>
                          <span className="text-[11px] text-gray-500">{tx.company.ticker}</span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {format(new Date(tx.created_at), 'yyyy.MM.dd HH:mm')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-100 tabular-nums">
                        {Math.floor(tx.shares * tx.price).toLocaleString()}원
                      </div>
                      <div className="text-[11px] text-gray-500 tabular-nums">
                        {tx.shares.toLocaleString()}주 × {Math.floor(tx.price).toLocaleString()}원
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filtered.length === 0 && (
                <div className="py-8 text-center text-gray-500 text-sm">
                  {filter === 'all' ? '거래 내역이 없습니다.' : `${filter === 'buy' ? '매수' : '매도'} 내역이 없습니다.`}
                </div>
              )}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-5 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="border-gray-700 w-9 h-9 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`
                      w-9 h-9 p-0
                      ${currentPage === page 
                        ? 'bg-blue-500 hover:bg-blue-600 border-none' 
                        : 'border-gray-700 hover:bg-gray-800'}
                    `}
                  >
                    {page}
                  </Button>
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="border-gray-700 w-9 h-9 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}