'use client'

import { useState, useEffect } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { NewspaperIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeNews } from '@/hooks/useRealtimeNews'

interface CompanyNewsProps {
  companyId: string;
  initialNews: {
    id: string;
    title: string;
    content: string;
    published_at: string;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
}

export function CompanyNews({ companyId, initialNews }: CompanyNewsProps) {
  const { newsData, latestUpdate } = useRealtimeNews(initialNews)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAlert, setShowAlert] = useState(false)
  
  const itemsPerPage = 1
  const totalPages = Math.ceil(newsData.length / itemsPerPage)
  const currentNews = newsData[currentPage - 1]

  useEffect(() => {
    if (latestUpdate) {
      setCurrentPage(1)
      setShowAlert(true)
      setTimeout(() => setShowAlert(false), 3000)
    }
  }, [latestUpdate])

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

  if (newsData.length === 0) {
    return (
      <>
        <CardHeader>
          <div className="flex items-center gap-2">
            <NewspaperIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              기업 뉴스
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-center py-4">아직 등록된 뉴스가 없습니다.</p>
        </CardContent>
      </>
    )
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NewspaperIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              기업 뉴스
            </h2>
          </div>
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
              transition={{ duration: 0.6, ease: "easeOut" }}
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