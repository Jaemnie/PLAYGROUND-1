'use client'

import { useEffect, useState, useRef } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createChart, ColorType, IChartApi, CandlestickData } from 'lightweight-charts'
import { motion, AnimatePresence } from 'framer-motion'

interface PriceChartProps {
  company: any
  timeframe: string
  onTimeframeChange: (timeframe: string) => void
}

interface PriceUpdate {
  id: string;
  company_id: string;
  old_price: number;
  new_price: number;
  change_percentage: number;
  update_reason: string;
  created_at: string;
}

const TIMEFRAMES = {
  '1M': '1분봉',
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
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [data, setData] = useState<CandlestickData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasNoData, setHasNoData] = useState(false)

  useEffect(() => {
    if (chartContainerRef.current) {
      // 차트 생성
      chartRef.current = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#9CA3AF',
        },
        grid: {
          vertLines: { color: '#374151' },
          horzLines: { color: '#374151' },
        },
        width: chartContainerRef.current.clientWidth,
        height: 400,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#374151',
        },
        rightPriceScale: {
          borderColor: '#374151',
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: '#9CA3AF',
            width: 1,
            style: 3,
          },
          horzLine: {
            color: '#9CA3AF',
            width: 1,
            style: 3,
          },
        },
      })

      // 캔들스틱 시리즈만 추가
      const candlestickSeries = chartRef.current.addCandlestickSeries({
        upColor: '#22C55E',
        downColor: '#EF4444',
        borderVisible: false,
        wickUpColor: '#22C55E',
        wickDownColor: '#EF4444',
      })

      if (data.length > 0) {
        candlestickSeries.setData(data)
        chartRef.current.timeScale().fitContent()
      }

      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          })
        }
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        chartRef.current?.remove()
      }
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
    
    // 날짜를 YYYY-MM-DD 형식으로 변환
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // 시간을 HH:MM 형식으로 변환
    const formatTimeString = (date: Date) => {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    switch (timeframe) {
      case '1M':
      case '30M':
      case '1H':
        return `${formatDate(date)} ${formatTimeString(date)}`
      case '1D':
      case '7D':
        return formatDate(date)
      default:
        return formatDate(date)
    }
  }

  const processChartData = (updates: PriceUpdate[]): CandlestickData[] => {
    let lastValidPrice = company.current_price;
    const sortedUpdates = [...updates].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // 시간대별로 데이터 그룹화
    const groupedData = new Map<string, number[]>();
    
    sortedUpdates.forEach(update => {
      const timeKey = formatTime(update.created_at, timeframe);
      const price = update.new_price || lastValidPrice;
      lastValidPrice = price;
      
      if (!groupedData.has(timeKey)) {
        groupedData.set(timeKey, [price]);
      } else {
        groupedData.get(timeKey)?.push(price);
      }
    });

    // CandlestickData 형식으로 변환
    return Array.from(groupedData.entries()).map(([time, prices]): CandlestickData => ({
      time,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
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