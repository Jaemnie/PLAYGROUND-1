'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface PriceChartProps {
  company: any
  timeframe: string
  onTimeframeChange: (timeframe: string) => void
  formatPrice: (value: number) => string
}

export function PriceChart({ 
  company, 
  timeframe, 
  onTimeframeChange 
}: PriceChartProps) {
  const [data, setData] = useState<Array<{ time: string; price: number }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (company?.ticker && timeframe) {
      setIsLoading(true)
      fetch(`/api/stock/prices?ticker=${company.ticker}&timeframe=${timeframe}`)
        .then((res) => res.json())
        .then((result) => {
          setData(result.prices || [])
          setIsLoading(false)
        })
        .catch((error) => {
          console.error('가격 데이터 로딩 오류:', error)
          setIsLoading(false)
        })
    }
  }, [company, timeframe])

  const timeframes = ['1D', '1W', '1M', '3M', '1Y']
  
  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">가격 차트</h2>
          <div className="flex gap-2">
            {timeframes.map((tf) => (
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
                {tf}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis 
                dataKey="time" 
                stroke="#4B5563"
                tick={{ fill: '#9CA3AF' }}
                tickLine={{ stroke: '#4B5563' }}
                axisLine={{ stroke: '#4B5563' }}
              />
              <YAxis 
                stroke="#4B5563"
                tick={{ fill: '#9CA3AF' }}
                tickLine={{ stroke: '#4B5563' }}
                axisLine={{ stroke: '#4B5563' }}
                domain={['auto', 'auto']}
                tickFormatter={(value) => `${Math.round(value).toLocaleString()}원`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem'
                }}
                labelStyle={{ color: '#9CA3AF' }}
                itemStyle={{ color: '#60A5FA' }}
                formatter={(value: any) => [`${Math.round(Number(value)).toLocaleString()}원`]}
              />
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#60A5FA"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: '#60A5FA' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </>
  )
} 