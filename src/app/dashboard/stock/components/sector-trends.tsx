'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

interface SectorTrendsData {
  sectorTrends: Record<string, number>
}

const INDUSTRY_ORDER = ['IT', '전자', '제조', '건설', '식품'] as const

function getTrendColor(strength: number): { text: string; bar: string } {
  if (strength > 0.3) return { text: 'text-green-400', bar: 'bg-green-400' }
  if (strength > 0.1) return { text: 'text-green-400/70', bar: 'bg-green-400/70' }
  if (strength > -0.1) return { text: 'text-gray-400', bar: 'bg-gray-500' }
  if (strength > -0.3) return { text: 'text-red-400/70', bar: 'bg-red-400/70' }
  return { text: 'text-red-400', bar: 'bg-red-400' }
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
        ) : (
          <div className="space-y-1.5">
            {INDUSTRY_ORDER.map((industry, index) => {
              const strength = data.sectorTrends[industry] || 0
              const colors = getTrendColor(strength)
              const barPercent = Math.abs(strength) * 100
              const isPositive = strength >= 0

              return (
                <motion.div
                  key={industry}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-2 h-6"
                >
                  <span className="w-8 text-xs font-medium text-gray-400 flex-shrink-0">{industry}</span>
                  <div className="flex-1 relative h-3 rounded-sm overflow-hidden bg-white/5">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPercent / 2}%` }}
                      transition={{ duration: 0.5, delay: index * 0.03 }}
                      className={`absolute top-0 bottom-0 rounded-sm ${colors.bar}`}
                      style={{ [isPositive ? 'left' : 'right']: '50%' }}
                    />
                  </div>
                  <span className={`w-10 text-xs font-bold tabular-nums text-right ${colors.text}`}>
                    {strength > 0 ? '+' : ''}{(strength * 100).toFixed(0)}%
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
