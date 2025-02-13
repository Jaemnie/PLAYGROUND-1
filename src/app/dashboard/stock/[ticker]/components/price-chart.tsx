'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { ApexOptions } from 'apexcharts'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface PriceChartProps {
  company: any
  timeframe: string
  onTimeframeChange: (timeframe: string) => void
}

const TIMEFRAMES = {
  '5M': '5분봉',
  '30M': '30분봉',
  '1H': '1시간봉',
  '1D': '1일봉',
  '7D': '7일봉'
} as const

export function PriceChart({ company, timeframe = '5M', onTimeframeChange }: PriceChartProps) {
  const [series, setSeries] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasNoData, setHasNoData] = useState(false)

  const options: ApexOptions = {
    chart: {
      type: 'candlestick' as const,
      height: 400,
      background: 'transparent',
      animations: {
        enabled: false
      },
      toolbar: {
        show: false
      },
      defaultLocale: 'ko',
      locales: [{
        name: 'ko',
        options: {
          months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
          shortMonths: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
          days: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
          shortDays: ['일', '월', '화', '수', '목', '금', '토']
        }
      }]
    },
    theme: {
      mode: 'dark'
    },
    tooltip: {
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
        const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
        const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
        const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
        
        return `
          <div class="p-2 bg-gray-900 border border-gray-700 rounded-lg">
            <div class="text-gray-400">시가: ${Math.floor(o).toLocaleString()}원</div>
            <div class="text-green-400">고가: ${Math.floor(h).toLocaleString()}원</div>
            <div class="text-red-400">저가: ${Math.floor(l).toLocaleString()}원</div>
            <div class="text-gray-200">종가: ${Math.floor(c).toLocaleString()}원</div>
          </div>
        `;
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: '#9CA3AF'
        },
        datetimeFormatter: {
          year: 'yyyy년',
          month: 'M월',
          day: 'd일',
          hour: 'HH:mm'
        },
        datetimeUTC: false
      }
    },
    yaxis: {
      tooltip: {
        enabled: true
      },
      labels: {
        style: {
          colors: '#9CA3AF'
        },
        formatter: (value: number) => `${Math.floor(value).toLocaleString()}원`
      }
    },
    grid: {
      borderColor: '#374151'
    },
    fill: {
      opacity: 1
    },
    states: {
      active: {
        filter: {
          type: 'none'
        }
      },
      hover: {
        filter: {
          type: 'lighten',
          value: 0.1
        } as { type: string; value: number }
      }
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#22C55E',
          downward: '#EF4444'
        },
        wick: {
          useFillColor: true,
        }
      }
    }
  }

  useEffect(() => {
    if (company?.ticker && timeframe) {
      setIsLoading(true)
      
      fetch(`/api/stock/price-history?ticker=${company.ticker}&timeframe=${timeframe}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.candleData || data.candleData.length === 0) {
            setHasNoData(true)
            setSeries([])
          } else {
            setHasNoData(false)
            setSeries([{ data: data.candleData }])
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

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/stock/price-history?ticker=${company.ticker}&timeframe=${timeframe}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.candleData?.length > 0) {
            setSeries([{ data: data.candleData }])
          }
        })
    }, 60000) // 1분마다 업데이트

    return () => clearInterval(interval)
  }, [company.ticker, timeframe])

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
              <ReactApexChart
                options={options}
                series={series}
                type="candlestick"
                height={400}
              />
            </motion.div>
          )}
        </div>
      </CardContent>
    </>
  )
}