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

export function NewsTicker({ news: initialNews }: NewsTickerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const { newsData, latestUpdate } = useRealtimeNews(initialNews)
  
  const itemsPerPage = 1
  const totalPages = Math.ceil(newsData.length / itemsPerPage)
  const currentNews = newsData[currentPage - 1]

  // 새로운 뉴스가 추가되면 첫 페이지로 이동
  useEffect(() => {
    if (latestUpdate) {
      setCurrentPage(1)
    }
  }, [latestUpdate])

  // 자동 슬라이드 효과
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev === totalPages ? 1 : prev + 1))
    }, 5000)

    return () => clearInterval(interval)
  }, [totalPages])

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
          <span className="text-sm text-gray-400">
            {currentPage} / {totalPages}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative min-h-[140px]">
          <AnimatePresence>
            <motion.div
              key={currentNews?.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className={`absolute inset-0 space-y-3 p-4 rounded-xl border ${getImpactStyle(currentNews?.impact || 'neutral')}`}
            >
              <div
                className={latestUpdate === currentNews?.id ? 'ring-2 ring-blue-500/50 rounded-lg' : ''}
              >
                <h3 className="font-bold text-gray-100 mb-2 line-clamp-1">
                  {currentNews?.title}
                </h3>
                <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                  {currentNews?.content}
                </p>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-500">
                    {currentNews?.published_at && formatDate(currentNews.published_at)}
                  </p>
                  {latestUpdate === currentNews?.id && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                      NEW
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
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
