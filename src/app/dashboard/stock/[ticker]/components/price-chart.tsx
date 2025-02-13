'use client'

import { useEffect, useState, useRef } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createChart } from 'lightweight-charts'
import { motion, AnimatePresence } from 'framer-motion'
import { IChartApi } from 'lightweight-charts'

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

interface ExtendedChartApi extends IChartApi {
  addCandlestickSeries: (options?: {
    upColor?: string;
    downColor?: string;
    borderVisible?: boolean;
    wickUpColor?: string;
    wickDownColor?: string;
  }) => {
    setData: (data: any[]) => void;
  };
  addHistogramSeries: (options: any) => any;
}

type ChartType = {
  addCandlestickSeries: (options: any) => any;
  addHistogramSeries: (options: any) => any;
  remove: () => void;
}

type ChartData = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function PriceChart({ 
  company, 
  timeframe, 
  onTimeframeChange 
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasNoData, setHasNoData] = useState(false)

  useEffect(() => {
    if (chartContainerRef.current && data.length > 0) {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: 'transparent' },
          textColor: '#9CA3AF',
        },
        grid: {
          vertLines: { color: '#374151' },
          horzLines: { color: '#374151' },
        },
        width: chartContainerRef.current.clientWidth,
        height: 400,
      }) as ExtendedChartApi;

      // 캔들스틱 시리즈 생성
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350'
      });

      candlestickSeries.setData(data.map(item => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close
      })));

      return () => {
        chart.remove();
      };
    }
  }, [data])

  useEffect(() => {
    if (company?.ticker && timeframe) {
      setIsLoading(true)
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
              volume: 0
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
      case '5M':
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

  const processChartData = (updates: any[]): ChartData[] => {
    // 시간대별로 데이터 그룹화
    const groupedData = updates.reduce((acc, update) => {
      const timeKey = formatTime(update.created_at, timeframe)
      if (!acc[timeKey]) {
        acc[timeKey] = {
          time: timeKey,
          open: update.old_price,
          high: Math.max(update.old_price, update.new_price),
          low: Math.min(update.old_price, update.new_price),
          close: update.new_price,
          volume: 1
        }
      } else {
        acc[timeKey].high = Math.max(acc[timeKey].high, update.new_price)
        acc[timeKey].low = Math.min(acc[timeKey].low, update.new_price)
        acc[timeKey].close = update.new_price
        acc[timeKey].volume += 1
      }
      return acc
    }, {} as Record<string, ChartData>)

    return Object.values(groupedData)
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
            <motion.div
              ref={chartContainerRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            />
          )}
        </div>
      </CardContent>
    </>
  )
} 