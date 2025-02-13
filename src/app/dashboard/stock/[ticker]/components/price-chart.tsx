'use client'

import { useEffect, useState, useRef } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createChart, ColorType, IChartApi, LineWidth, CandlestickSeries } from 'lightweight-charts'
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

interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface ExtendedIChartApi extends IChartApi {
  addCandlestickSeries: any;
}

export function PriceChart({ 
  company, 
  timeframe, 
  onTimeframeChange 
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ExtendedIChartApi | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasNoData, setHasNoData] = useState(false)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chartOptions = {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: '#4B5563',
          width: 1 as LineWidth,
          style: 3,
        },
        horzLine: {
          color: '#4B5563',
          width: 1 as LineWidth,
          style: 3,
        },
      },
    }

    chartRef.current = createChart(chartContainerRef.current, {
      ...chartOptions,
      width: chartContainerRef.current.clientWidth,
      height: 400,
    }) as ExtendedIChartApi

    const candlestickSeries = chartRef.current.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    })

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    const fetchData = async () => {
      if (!company?.ticker) return
      
      setIsLoading(true)
      try {
        const response = await fetch(`/api/stock/price-history?ticker=${company.ticker}&timeframe=${timeframe}`)
        const data = await response.json()

        if (!data.priceUpdates || data.priceUpdates.length === 0) {
          setHasNoData(true)
          return
        }

        if (chartRef.current && candlestickSeries) {
          const candleData = processCandleData(data.priceUpdates)
          if (candleData.length > 0) {
            candleData.forEach(candle => {
              try {
                candlestickSeries.update(candle)
              } catch (error) {
                console.error('캔들 데이터 업데이트 오류:', error)
              }
            })
            setHasNoData(false)
          } else {
            setHasNoData(true)
          }
        }
      } catch (error) {
        console.error('가격 데이터 로딩 오류:', error)
        setHasNoData(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
      }
    }
  }, [company, timeframe])

  const processCandleData = (updates: any[]): CandleData[] => {
    const candleData: CandleData[] = []
    let currentCandle: Partial<CandleData> = {}

    updates.forEach((update, index) => {
      const price = update.new_price
      const time = new Date(update.created_at).getTime() / 1000

      if (!price) return

      if (!currentCandle.open) {
        currentCandle = {
          time,
          open: price,
          high: price,
          low: price,
          close: price,
        }
      } else {
        currentCandle.high = Math.max(currentCandle.high!, price)
        currentCandle.low = Math.min(currentCandle.low!, price)
        currentCandle.close = price
      }

      if (
        index === updates.length - 1 || 
        new Date(updates[index + 1].created_at).getTime() - new Date(update.created_at).getTime() > getTimeframeInMs(timeframe)
      ) {
        candleData.push(currentCandle as CandleData)
        currentCandle = {}
      }
    })

    return candleData
  }

  const getTimeframeInMs = (tf: string): number => {
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    switch (tf) {
      case '1M': return minute
      case '5M': return 5 * minute
      case '30M': return 30 * minute
      case '1H': return hour
      case '1D': return day
      case '7D': return 7 * day
      default: return minute
    }
  }

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
            <div ref={chartContainerRef} className="h-full w-full" />
          )}
        </div>
      </CardContent>
    </>
  )
} 