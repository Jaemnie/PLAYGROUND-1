'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
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
    price: number
    changePercent: number 
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasNoData, setHasNoData] = useState(false)
  const [prevData, setPrevData] = useState<any[]>([]) // 이전 데이터 저장용

  useEffect(() => {
    if (company?.ticker && timeframe) {
      setIsLoading(true)
      // 현재 데이터를 이전 데이터로 저장
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
              price: company.current_price,
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
    let lastValidPrice = company.current_price;
    let prevPrice = company.current_price;
    
    return updates.map((update, index) => {
      const currentPrice = update.new_price || lastValidPrice;
      const priceChange = currentPrice - prevPrice;
      const isPositiveChange = priceChange > 0;
      const isPriceReversal = 
        (prevPrice > lastValidPrice && currentPrice < prevPrice) || // 음전
        (prevPrice < lastValidPrice && currentPrice > prevPrice);   // 양전
      
      prevPrice = currentPrice;
      lastValidPrice = currentPrice;

      return {
        time: formatTime(update.created_at, timeframe),
        price: currentPrice,
        changePercent: update.change_percentage || 0,
        hasData: update.new_price !== null,
        isReversal: isPriceReversal,
        isPositiveChange,
        priceDirection: index === 0 ? 'none' : currentPrice >= updates[index - 1]?.new_price ? 'up' : 'down'
      };
    });
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
                <LineChart data={isLoading ? prevData : data}>
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
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                    formatter={(value: any, name: string, props: any) => {
                      if (name === 'price') {
                        const payload = props.payload;
                        let label = `${Math.round(Number(value)).toLocaleString()}원`;
                        if (payload.isReversal) {
                          label += payload.isPositiveChange ? ' (양전)' : ' (음전)';
                        }
                        return [label, '가격'];
                      }
                      return [`${value.toFixed(2)}%`, '변동률'];
                    }}
                  />
                  <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={(data: any) => {
                      return data.priceDirection === 'up' ? '#EF4444' : '#3B82F6';
                    }}
                    dot={(props: any): React.ReactElement<SVGElement> => {
                      const { payload, cx, cy } = props;
                      if (!payload.hasData) return <circle cx={cx} cy={cy} r={0} />;
                      
                      if (payload.isReversal) {
                        const color = payload.isPositiveChange ? '#EF4444' : '#3B82F6';
                        return (
                          <g>
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={4} 
                              fill={color}
                              stroke={color}
                            />
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={6} 
                              fill="none"
                              stroke={color}
                              strokeWidth="1"
                              opacity="0.5"
                            />
                          </g>
                        );
                      }
                      
                      const color = payload.priceDirection === 'up' ? '#EF4444' : '#3B82F6';
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={3} 
                          fill={color}
                          stroke={color}
                        />
                      );
                    }}
                    connectNulls={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>
      </CardContent>
    </>
  )
} 