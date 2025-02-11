'use client'

import { useState, useEffect } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { NewspaperIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeNews } from '@/hooks/useRealtimeNews'

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

function NewsAlert() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute -top-4 left-1/2 -translate-x-1/2 px-2 py-1 bg-blue-500/20 backdrop-blur-sm rounded-full border border-blue-500/30"
    >
      <div className="flex items-center gap-1">
        <NewspaperIcon className="w-3 h-3 text-blue-400" />
        <span className="text-xs font-bold text-blue-400">새로운 뉴스!</span>
      </div>
      <motion.div 
        className="absolute inset-0 rounded-full bg-blue-400/20"
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </motion.div>
  )
}

export function NewsTicker({ news: initialNews }: NewsTickerProps) {
  const { newsData, latestUpdate } = useRealtimeNews(initialNews)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAlert, setShowAlert] = useState(false)
  const [autoSlideEnabled, setAutoSlideEnabled] = useState(true)
  
  const itemsPerPage = 1
  const totalPages = Math.ceil(newsData.length / itemsPerPage)
  const currentNews = newsData[currentPage - 1]

  useEffect(() => {
    if (latestUpdate) {
      setCurrentPage(1)
      setShowAlert(true)
      setAutoSlideEnabled(false)
      
      setTimeout(() => {
        setShowAlert(false)
        setAutoSlideEnabled(true)
      }, 3000)
    }
  }, [latestUpdate])

  // 자동 슬라이드 효과
  useEffect(() => {
    if (!autoSlideEnabled) return
    
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev === totalPages ? 1 : prev + 1))
    }, 10000)

    return () => clearInterval(interval)
  }, [totalPages, autoSlideEnabled])

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
          <AnimatePresence>
            {showAlert && <NewsAlert />}
          </AnimatePresence>
          <span className="text-sm text-gray-500/70">
            {currentPage} / {totalPages}
          </span>
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="space-y-2"
              >
                <h3 className="font-bold text-gray-100 mb-2 line-clamp-1 text-lg">
                  {currentNews?.title}
                </h3>
                <p className="text-sm text-gray-300/90 line-clamp-2 mb-2 leading-relaxed">
                  {currentNews?.content}
                </p>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs text-gray-400/80"
                >
                  {currentNews?.published_at && formatDate(currentNews.published_at)}
                </motion.p>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-between items-center mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="text-gray-400 hover:bg-gray-800/50 hover:text-gray-300 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
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
