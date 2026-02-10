'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createChart, ColorType, CrosshairMode, IChartApi } from 'lightweight-charts'

interface PriceChartProps {
  company: { ticker: string; current_price: number }
  timeframe: string
  onTimeframeChange: (timeframe: string) => void
}

interface CandleDataPoint {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// KST 오프셋 (초 단위) - lightweight-charts가 UTC 기준이므로 한국 시간으로 보정
const KST_OFFSET_SEC = 9 * 60 * 60

function formatKSTDate(utcTimestamp: number): string {
  const date = new Date(utcTimestamp * 1000)
  const kst = new Date(date.getTime() + KST_OFFSET_SEC * 1000)
  const month = kst.getUTCMonth() + 1
  const day = kst.getUTCDate()
  const hours = kst.getUTCHours().toString().padStart(2, '0')
  const minutes = kst.getUTCMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

const TIMEFRAMES: Record<string, string> = {
  '1M': '1분',
  '5M': '5분',
  '30M': '30분',
  '1H': '1시간',
  '1D': '1일',
  '1W': '1주',
}

// 1분봉은 라인 차트, 나머지는 캔들스틱
function isLineMode(timeframe: string): boolean {
  return timeframe === '1M'
}

export function PriceChart({ company, timeframe = '5M', onTimeframeChange }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null)
  const currentModeRef = useRef<'line' | 'candle' | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasNoData, setHasNoData] = useState(false)

  // 차트 생성/재생성 (시리즈 타입이 바뀔 때)
  const initChart = useCallback(() => {
    if (!chartContainerRef.current) return

    // 기존 차트 제거
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      seriesRef.current = null
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      localization: {
        timeFormatter: (time: number) => formatKSTDate(time),
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000)
          const kst = new Date(date.getTime() + KST_OFFSET_SEC * 1000)
          const hours = kst.getUTCHours().toString().padStart(2, '0')
          const minutes = kst.getUTCMinutes().toString().padStart(2, '0')
          return `${hours}:${minutes}`
        },
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    })

    if (isLineMode(timeframe)) {
      const lineSeries = chart.addAreaSeries({
        lineColor: '#60A5FA',
        topColor: 'rgba(96, 165, 250, 0.3)',
        bottomColor: 'rgba(96, 165, 250, 0.02)',
        lineWidth: 2,
      })
      seriesRef.current = lineSeries
      currentModeRef.current = 'line'
    } else {
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22C55E',
        downColor: '#EF4444',
        wickUpColor: '#22C55E',
        wickDownColor: '#EF4444',
        borderVisible: false,
      })
      seriesRef.current = candleSeries
      currentModeRef.current = 'candle'
    }

    chartRef.current = chart
  }, [timeframe])

  // 타임프레임 변경 시 차트 재생성 (시리즈 타입이 달라지므로)
  useEffect(() => {
    initChart()

    // ResizeObserver
    let resizeObserver: ResizeObserver | null = null
    if (chartContainerRef.current && chartRef.current) {
      const chart = chartRef.current
      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          chart.applyOptions({ width: entry.contentRect.width })
        }
      })
      resizeObserver.observe(chartContainerRef.current)
    }

    return () => {
      resizeObserver?.disconnect()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
        currentModeRef.current = null
      }
    }
  }, [initChart])

  // 데이터 fetch
  const fetchData = useCallback(async () => {
    if (!company?.ticker || !timeframe || !seriesRef.current) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/stock/price-history?ticker=${company.ticker}&timeframe=${timeframe}`)
      const data = await res.json()

      if (!data.candleData || data.candleData.length === 0) {
        setHasNoData(true)
        seriesRef.current.setData([])
      } else {
        setHasNoData(false)
        const raw = data.candleData as CandleDataPoint[]

        if (isLineMode(timeframe)) {
          // 라인 차트: close 값만 사용
          const lineData = raw
            .map(d => ({
              time: (d.time + KST_OFFSET_SEC) as number,
              value: d.close,
            }))
            .sort((a, b) => a.time - b.time)
          seriesRef.current.setData(lineData as any)
        } else {
          // 캔들스틱 차트
          const candleData = raw
            .map(d => ({
              time: (d.time + KST_OFFSET_SEC) as number,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
            }))
            .sort((a, b) => a.time - b.time)
          seriesRef.current.setData(candleData as any)
        }

        chartRef.current?.timeScale().fitContent()
      }
    } catch (error) {
      console.error('가격 기록 로딩 오류:', error)
      setHasNoData(true)
    } finally {
      setIsLoading(false)
    }
  }, [company?.ticker, timeframe])

  // 차트 준비 후 데이터 로드
  useEffect(() => {
    // initChart가 완료된 후 약간의 딜레이로 데이터 로드
    const timer = setTimeout(fetchData, 50)
    return () => clearTimeout(timer)
  }, [fetchData])

  // 1분마다 자동 갱신
  useEffect(() => {
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-semibold text-gray-100">가격 차트</h2>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(TIMEFRAMES).map(([tf, label]) => (
              <Button
                key={tf}
                variant={timeframe === tf ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTimeframeChange(tf)}
                className={timeframe === tf 
                  ? 'bg-blue-500 hover:bg-blue-600 h-8 px-3 text-xs' 
                  : 'border-gray-700 hover:bg-gray-800 h-8 px-3 text-xs'
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
          {/* 로딩 오버레이 */}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg">
              <div className="space-y-2 text-center">
                <div className="h-5 w-24 mx-auto rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-16 mx-auto rounded bg-white/5 animate-pulse" />
              </div>
            </div>
          )}

          {/* 데이터 없음 상태 */}
          {hasNoData && !isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
              <span className="text-gray-400">
                선택한 시간대의 거래 데이터가 없습니다
              </span>
              <p className="text-sm text-gray-500">
                현재가: {Math.floor(company.current_price).toLocaleString()}원
              </p>
            </div>
          )}

          {/* 차트 컨테이너 */}
          <div
            ref={chartContainerRef}
            className="h-full w-full"
            style={{ visibility: hasNoData && !isLoading ? 'hidden' : 'visible' }}
          />
        </div>
      </CardContent>
    </>
  )
}
