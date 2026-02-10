'use client'

import { useState, useEffect } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { NewspaperIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeNews } from '@/hooks/useRealtimeNews'
import Link from 'next/link'

interface NewsTickerProps {
  news: {
    id: string
    title: string
    content: string
    published_at: string
    impact: 'positive' | 'negative' | 'neutral'
    related_company_id?: string
  }[]
}

export function NewsTicker({ news: initialNews }: NewsTickerProps) {
  const { newsData, latestUpdate } = useRealtimeNews(initialNews)
  const [currentPage, setCurrentPage] = useState(1)
  
  const totalPages = Math.ceil(newsData.length / 1)
  const currentNews = newsData[currentPage - 1]

  // 새 뉴스 도착 시 첫 페이지로 이동
  useEffect(() => {
    if (latestUpdate) setCurrentPage(1)
  }, [latestUpdate])

  const renderPageButtons = () => {
    const buttons = []
    const maxVisibleButtons = 5
    let startPage = 1
    let endPage = totalPages
    
    if (totalPages > maxVisibleButtons) {
      const halfVisible = Math.floor(maxVisibleButtons / 2)
      startPage = Math.max(1, currentPage - halfVisible)
      endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1)
      if (endPage === totalPages) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1)
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentPage(i)}
          className={i === currentPage 
            ? "bg-blue-500 text-white hover:bg-blue-600 w-8 h-8 p-0" 
            : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-300 w-8 h-8 p-0"}
        >
          {i}
        </Button>
      )
    }
    
    return buttons
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getImpactStyle = (impact: 'positive' | 'negative' | 'neutral') => {
    switch (impact) {
      case 'positive':
        return 'bg-green-500/10 border-green-500/20'
      case 'negative':
        return 'bg-red-500/10 border-red-500/20'
      default:
        return 'bg-blue-500/10 border-blue-500/20'
    }
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NewspaperIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              실시간 뉴스
            </h2>
          </div>
          <Link 
            href="/dashboard/stock/news" 
            className="px-2 py-1 text-sm font-medium text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-md hover:bg-blue-500/10 transition-colors"
          >
            더보기 →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-[140px] overflow-hidden">
          <AnimatePresence mode="wait">
            {currentNews && (
              <motion.div
                key={currentNews.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`space-y-3 p-4 rounded-xl h-full ${getImpactStyle(currentNews.impact || 'neutral')}`}
              >
                <h3 className="font-bold text-gray-100 mb-2 line-clamp-1 text-lg">
                  {currentNews.title}
                </h3>
                <p className="text-sm text-gray-300/90 line-clamp-2 mb-2 leading-relaxed">
                  {currentNews.content}
                </p>
                <p className="text-xs text-gray-400/80">
                  {formatDate(currentNews.published_at)}
                </p>
              </motion.div>
            )}
            {!currentNews && (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                뉴스가 없습니다
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-center items-center mt-6 gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="text-gray-400 hover:bg-gray-800/50 hover:text-gray-300 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
          
          {renderPageButtons()}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="text-gray-400 hover:bg-gray-800/50 hover:text-gray-300 transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </>
  )
}
