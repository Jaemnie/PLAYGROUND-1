'use client'

import { useState, useEffect } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { NewspaperIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
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

function NewsAlert({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute -top-10 left-0 right-0 bg-blue-500/20 text-blue-300 px-4 py-2 rounded-md text-sm"
    >
      {count > 1 
        ? `${count}개의 새로운 뉴스가 추가되었습니다!` 
        : '새로운 뉴스가 추가되었습니다!'}
    </motion.div>
  )
}

export function NewsTicker({ news: initialNews }: NewsTickerProps) {
  const { newsData, latestUpdate, newItemsCount, resetNewItemsCount } = useRealtimeNews(initialNews)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAlert, setShowAlert] = useState(false)
  
  const itemsPerPage = 1
  const totalPages = Math.ceil(newsData.length / itemsPerPage)
  const currentNews = newsData[currentPage - 1]

  useEffect(() => {
    if (latestUpdate) {
      setCurrentPage(1)
      setShowAlert(true)
      setTimeout(() => {
        setShowAlert(false)
        resetNewItemsCount()
      }, 3000)
    }
  }, [latestUpdate, resetNewItemsCount])

  // 페이지 버튼 생성 함수
  const renderPageButtons = () => {
    const buttons = []
    const maxVisibleButtons = 5
    let startPage = 1
    let endPage = totalPages
    
    if (totalPages > maxVisibleButtons) {
      // 현재 페이지 주변의 버튼만 표시
      const halfVisible = Math.floor(maxVisibleButtons / 2)
      startPage = Math.max(1, currentPage - halfVisible)
      endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1)
      
      // 끝 부분에 도달하면 시작 페이지 조정
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
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NewspaperIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              실시간 뉴스
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link 
              href="/dashboard/stock/news" 
              className="px-2 py-1 text-sm font-medium text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-md hover:bg-blue-500/10 transition-colors"
            >
              더보기 →
            </Link>
            <AnimatePresence>
              {showAlert && <NewsAlert count={newItemsCount} />}
            </AnimatePresence>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative min-h-[140px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentNews?.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                duration: 0.6,
                ease: "easeOut"
              }}
              className={`absolute inset-0 space-y-3 p-4 rounded-xl ${getImpactStyle(currentNews?.impact || 'neutral')}`}
            >
              <h3 className="font-bold text-gray-100 mb-2 line-clamp-1 text-lg">
                {currentNews?.title}
              </h3>
              <p className="text-sm text-gray-300/90 line-clamp-2 mb-2 leading-relaxed">
                {currentNews?.content}
              </p>
              <p className="text-xs text-gray-400/80">
                {currentNews?.published_at && formatDate(currentNews.published_at)}
              </p>
            </motion.div>
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
