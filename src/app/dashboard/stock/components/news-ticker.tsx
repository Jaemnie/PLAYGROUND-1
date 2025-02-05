'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import { NewspaperIcon } from '@heroicons/react/24/outline'

interface News {
  id: string
  title: string
  content: string
  published_at: string
  company_id?: string
}

interface NewsTickerProps {
  news: News[]
}

export function NewsTicker({ news }: NewsTickerProps) {
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (isHovered) return

    const interval = setInterval(() => {
      setCurrentNewsIndex((prev) => (prev + 1) % news.length)
    }, 5000) // 5초마다 뉴스 변경

    return () => clearInterval(interval)
  }, [news.length, isHovered])

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

  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-2">
          <NewspaperIcon className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-gray-100">실시간 뉴스</h2>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          className="relative h-24 overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={news[currentNewsIndex]?.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <div className="space-y-2">
                <h3 className="font-medium text-gray-100">
                  {news[currentNewsIndex]?.title}
                </h3>
                <p className="text-sm text-gray-400 line-clamp-2">
                  {news[currentNewsIndex]?.content}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(news[currentNewsIndex]?.published_at)}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 뉴스 인디케이터 */}
        <div className="flex justify-center gap-1 mt-4">
          {news.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentNewsIndex ? 'bg-blue-500' : 'bg-gray-600'
              }`}
              onClick={() => setCurrentNewsIndex(index)}
            />
          ))}
        </div>
      </CardContent>
    </>
  )
}
