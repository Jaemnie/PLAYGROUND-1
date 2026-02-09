'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

interface SectorTrendsData {
  sectorTrends: Record<string, number>
  sectorTrendsUpdatedAt: string | null
}

const INDUSTRY_ORDER = ['IT', '전자', '제조', '건설', '식품'] as const

function getTrendLabel(strength: number): string {
  if (strength > 0.5) return '강세'
  if (strength > 0.15) return '약강세'
  if (strength > -0.15) return '보합'
  if (strength > -0.5) return '약약세'
  return '약세'
}

function getTrendColor(strength: number): { text: string; bar: string; bg: string } {
  if (strength > 0.3) return { text: 'text-green-400', bar: 'bg-green-400', bg: 'bg-green-400/10' }
  if (strength > 0.1) return { text: 'text-green-400/70', bar: 'bg-green-400/70', bg: 'bg-green-400/5' }
  if (strength > -0.1) return { text: 'text-gray-400', bar: 'bg-gray-500', bg: 'bg-gray-500/5' }
  if (strength > -0.3) return { text: 'text-red-400/70', bar: 'bg-red-400/70', bg: 'bg-red-400/5' }
  return { text: 'text-red-400', bar: 'bg-red-400', bg: 'bg-red-400/10' }
}

export function SectorTrends() {
  const [data, setData] = useState<SectorTrendsData>({
    sectorTrends: {},
    sectorTrendsUpdatedAt: null,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/stock/market-info')
        const json = await res.json()
        if (json && !json.error) {
          setData({
            sectorTrends: json.sectorTrends || {},
            sectorTrendsUpdatedAt: json.sectorTrendsUpdatedAt || null,
          })
        }
      } catch {
        /* 기본값 유지 */
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    const timer = setInterval(fetchData, 30000) // 30초마다 갱신
    return () => clearInterval(timer)
  }, [])

  const formatUpdatedAt = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              섹터 트렌드
            </h2>
          </div>
          {data.sectorTrendsUpdatedAt && (
            <span className="text-xs text-gray-500">
              {formatUpdatedAt(data.sectorTrendsUpdatedAt)} 기준
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-gray-500">로딩 중...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {INDUSTRY_ORDER.map((industry, index) => {
              const strength = data.sectorTrends[industry] || 0
              const colors = getTrendColor(strength)
              const label = getTrendLabel(strength)
              // 바 너비: 0~100% (strength -1~1을 0~100으로 매핑)
              const barPercent = Math.abs(strength) * 100
              const isPositive = strength >= 0

              return (
                <motion.div
                  key={industry}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 p-2.5 rounded-lg ${colors.bg} border border-white/5`}
                >
                  {/* 산업명 */}
                  <div className="w-10 text-sm font-medium text-gray-300 flex-shrink-0">
                    {industry}
                  </div>

                  {/* 바 시각화 */}
                  <div className="flex-1 relative h-5">
                    {/* 중앙선 */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                    {/* 바 배경 */}
                    <div className="absolute inset-0 rounded bg-white/5" />
                    {/* 실제 바 */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPercent / 2}%` }}
                      transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' }}
                      className={`absolute top-0.5 bottom-0.5 rounded ${colors.bar}`}
                      style={{
                        [isPositive ? 'left' : 'right']: '50%',
                      }}
                    />
                  </div>

                  {/* 수치 + 라벨 */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 w-24 justify-end">
                    <span className={`text-sm font-bold tabular-nums ${colors.text}`}>
                      {strength > 0 ? '+' : ''}{(strength * 100).toFixed(0)}%
                    </span>
                    <span className={`text-xs ${colors.text}`}>
                      {label}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </>
  )
}
