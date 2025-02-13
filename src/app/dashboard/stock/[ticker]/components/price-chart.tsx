'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Bar, Cell } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'

interface PriceChartProps {
  company: any
  timeframe: string
  onTimeframeChange: (timeframe: string) => void
}

const TIMEFRAMES = {
  '1M': '1분봉',
  '5M': '5분봉',
  '30M': '30분봉',
  '1H': '1시간봉',
  '1D': '1일봉',
  '7D': '7일봉'
} as const

export function PriceChart({ 
  company, 
  timeframe, 
  onTimeframeChange 
}: PriceChartProps) {
  const [data, setData] = useState<Array<{ 
    time: string
    open: number
    high: number
    low: number
    close: number
    changePercent: number 
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasNoData, setHasNoData] = useState(false)
  const [prevData, setPrevData] = useState<any[]>([]) // 이전 데이터 저장용

  useEffect(() => {
    if (company?.ticker && timeframe) {
      setIsLoading(true)
      if (data.length > 0) {
        setPrevData(data)
      }
      
      fetch(`/api/stock/price-history?ticker=${company.ticker}&timeframe=${timeframe}`)
        .then((res) => res.json())
        .then((result) => {
          if (!result.priceUpdates || result.priceUpdates.length === 0) {
            setHasNoData(true)
            setData([{
              time: '현재',
              open: company.current_price,
              high: company.current_price,
              low: company.current_price,
              close: company.current_price,
              changePercent: 0
            }])
          } else {
            const formattedData = processChartData(result.priceUpdates)
            setData(formattedData)
          }
          setIsLoading(false)
        })
        .catch((error) => {
          console.error('가격 기록 로딩 오류:', error)
          setHasNoData(true)
          setIsLoading(false)
        })
    }
  }, [company, timeframe])

  const formatTime = (timestamp: string, timeframe: string) => {
    const date = new Date(timestamp)
    switch (timeframe) {
      case '1M':
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      case '30M':
      case '1H':
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      case '1D':
        return date.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit'
        })
      case '7D':
        return date.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric'
        })
      default:
        return date.toLocaleString('ko-KR')
    }
  }

  const processChartData = (updates: any[]) => {
    return updates.map((update, index) => ({
      time: formatTime(update.created_at, timeframe),
      open: update.open_price || update.new_price,
      high: update.high_price || update.new_price,
      low: update.low_price || update.new_price,
      close: update.new_price,
      changePercent: update.change_percentage || 0
    }));
  };

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">가격 차트</h2>
          <div className="flex gap-2">
            {Object.entries(TIMEFRAMES).map(([tf, label]) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => onTimeframeChange(tf)}
                className={timeframe === tf 
                  ? "bg-blue-500 hover:bg-blue-600" 
                  : "border-gray-700 hover:bg-gray-800"
                }
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-[400px] w-full">
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm"
              >
                <span className="text-gray-400">로딩 중...</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          {hasNoData ? (
            <div className="flex flex-col h-full items-center justify-center gap-4">
              <span className="text-gray-400">
                선택한 시간대의 거래 데이터가 없습니다
              </span>
              <p className="text-sm text-gray-500">
                현재가: {Math.floor(company.current_price).toLocaleString()}원
              </p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={isLoading ? prevData : data}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  barGap={0}
                  barCategoryGap={8}
                >
                  <XAxis 
                    dataKey="time" 
                    stroke="#4B5563"
                    tick={{ fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    stroke="#4B5563"
                    tick={{ fill: '#9CA3AF' }}
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => `${Math.round(value).toLocaleString()}원`}
                    axisLine={{ stroke: '#4B5563' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      padding: '12px'
                    }}
                    formatter={(value: any, name: string, props: any) => {
                      const payload = props.payload
                      return [
                        <div key="tooltip" className="space-y-1">
                          <div className="font-medium">시가: {Math.round(payload.open).toLocaleString()}원</div>
                          <div className="font-medium">고가: {Math.round(payload.high).toLocaleString()}원</div>
                          <div className="font-medium">저가: {Math.round(payload.low).toLocaleString()}원</div>
                          <div className="font-medium">종가: {Math.round(payload.close).toLocaleString()}원</div>
                          <div className="text-sm text-gray-400">
                            변동률: {payload.changePercent.toFixed(2)}%
                          </div>
                        </div>,
                        ''
                      ]
                    }}
                  />
                  <CartesianGrid 
                    stroke="#374151" 
                    strokeDasharray="3 3" 
                    opacity={0.5}
                    vertical={false}
                  />
                  {data.map((entry, index) => {
                    const isUp = entry.close >= entry.open
                    return (
                      <React.Fragment key={index}>
                        <Bar
                          dataKey={isUp ? "close" : "open"}
                          fill={isUp ? '#EF4444' : '#3B82F6'}
                          stroke={isUp ? '#EF4444' : '#3B82F6'}
                          strokeWidth={1}
                          width={8}
                        />
                        <Bar
                          dataKey={isUp ? "open" : "close"}
                          fill={isUp ? '#EF4444' : '#3B82F6'}
                          stroke={isUp ? '#EF4444' : '#3B82F6'}
                          strokeWidth={1}
                          width={8}
                        />
                        <Line
                          type="monotone"
                          dataKey="high"
                          stroke={isUp ? '#EF4444' : '#3B82F6'}
                          dot={false}
                          strokeWidth={1}
                        />
                        <Line
                          type="monotone"
                          dataKey="low"
                          stroke={isUp ? '#EF4444' : '#3B82F6'}
                          dot={false}
                          strokeWidth={1}
                        />
                      </React.Fragment>
                    )
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>
      </CardContent>
    </>
  )
} 