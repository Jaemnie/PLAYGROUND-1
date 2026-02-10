'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

type TrendDirection = 'bullish' | 'neutral' | 'bearish'

interface SectorTrendsData {
  sectorTrends: Record<string, TrendDirection>
}

function getTrendInfo(direction: TrendDirection): {
  label: string
  color: string
  icon: string
} {
  switch (direction) {
    case 'bullish':
      return { label: '강세', color: 'text-green-400', icon: '▲' }
    case 'bearish':
      return { label: '약세', color: 'text-red-400', icon: '▼' }
    default:
      return { label: '보합', color: 'text-gray-400', icon: '─' }
  }
}

export function SectorTrends() {
  const [data, setData] = useState<SectorTrendsData>({ sectorTrends: {} })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/stock/market-info')
        const json = await res.json()
        if (json && !json.error) {
          setData({ sectorTrends: json.sectorTrends || {} })
        }
      } catch { /* 기본값 유지 */ }
      finally { setIsLoading(false) }
    }
    fetchData()
    const timer = setInterval(fetchData, 30000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ArrowTrendingUpIcon className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            섹터 트렌드
          </h2>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="text-center py-4 text-sm text-gray-500">로딩 중...</div>
        ) : Object.keys(data.sectorTrends).length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">섹터 정보가 없습니다.</div>
        ) : (
          <div className="space-y-1.5">
            {Object.keys(data.sectorTrends)
              .sort()
              .map((industry, index) => {
              const direction = data.sectorTrends[industry] || 'neutral'
              const info = getTrendInfo(direction as TrendDirection)

              return (
                <motion.div
                  key={industry}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-3 h-6"
                >
                  <span className="min-w-[3.5rem] text-xs font-medium text-gray-400 flex-shrink-0">{industry}</span>
                  <span className={`w-4 text-xs text-center ${info.color}`}>
                    {info.icon}
                  </span>
                  <span className={`text-xs font-bold ${info.color}`}>
                    {info.label}
                  </span>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </>
  )
}
