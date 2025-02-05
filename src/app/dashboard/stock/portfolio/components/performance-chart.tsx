'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface PerformanceChartProps {
  user: any
  portfolio: any[]
}

export default function PerformanceChart({ user, portfolio }: PerformanceChartProps) {
  const [data, setData] = useState<Array<{ time: string; value: number }>>([])
  const [timeframe, setTimeframe] = useState('1M')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    
    const fetchPerformance = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/stock/portfolio/performance?user_id=${user.id}&timeframe=${timeframe}`)
        const result = await response.json()
        setData(result.performance || [])
      } catch (error) {
        console.error('성과 데이터 로딩 오류:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPerformance()
  }, [timeframe, user?.id])

  const timeframes = ['1D', '1W', '1M', '3M', '1Y']

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">포트폴리오 수익률</h2>
          <div className="flex gap-2">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf)}
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
        <div className="h-64 w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-400">로딩 중...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <XAxis 
                  dataKey="time" 
                  stroke="#4B5563" 
                  tick={{ fill: '#9CA3AF' }} 
                />
                <YAxis 
                  stroke="#4B5563" 
                  tick={{ fill: '#9CA3AF' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151', 
                    borderRadius: '0.375rem' 
                  }}
                  formatter={(value: number) => [`${value}%`, '수익률']}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#60A5FA" 
                  strokeWidth={2} 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </>
  )
}
