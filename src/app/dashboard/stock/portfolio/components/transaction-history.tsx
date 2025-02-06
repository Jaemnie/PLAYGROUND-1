'use client'

import { format } from 'date-fns'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.ceil(transactions.length / itemsPerPage)
  
  const startIndex = (currentPage - 1) * itemsPerPage
  const displayedTransactions = transactions.slice(startIndex, startIndex + itemsPerPage)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-100">거래 내역</h2>
        <div className="text-sm text-gray-400">
          총 {transactions.length}개의 거래
        </div>
      </div>

      <div className="bg-black/20 rounded-2xl backdrop-blur-sm border border-white/5">
        <AnimatePresence mode="popLayout">
          {displayedTransactions.map((tx, index) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`
                p-4 flex items-center justify-between
                ${index !== displayedTransactions.length - 1 ? 'border-b border-white/5' : ''}
              `}
            >
              <div className="flex items-center gap-4">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${tx.transaction_type === 'buy' 
                    ? 'bg-blue-500/10 text-blue-400' 
                    : 'bg-red-500/10 text-red-400'}
                `}>
                  {tx.transaction_type === 'buy' ? '매수' : '매도'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-100">{tx.company.name}</span>
                    <span className="text-sm text-gray-400">{tx.company.ticker}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {format(new Date(tx.created_at), 'yyyy.MM.dd HH:mm')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-100">
                  {Math.floor(tx.total_amount).toLocaleString()}원
                </div>
                <div className="text-sm text-gray-400">
                  {tx.shares.toLocaleString()}주 × {Math.floor(tx.price).toLocaleString()}원
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {transactions.length === 0 && (
          <div className="py-8 text-center text-gray-400">
            거래 내역이 없습니다.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center mt-6 gap-2">
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
    </div>
  )
}