'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface PortfolioPerformance {
  // 시점별 포트폴리오 가치
  timestamp: string;
  // 현재 보유 주식의 평가 금액
  holdingsValue: number;
  // 실현된 누적 수익금
  realizedGains: number;
  // 현금 보유액 (미투자금 + 실현 수익)
  cashBalance: number;
  // 총 투자 원금 (누적)
  totalInvestment: number;
  // 전체 수익률 = (holdingsValue + realizedGains + cashBalance - totalInvestment) / totalInvestment * 100
  totalReturnRate: number;
}

// API 응답 구조
interface PerformanceResponse {
  performance: PortfolioPerformance[];
  summary: {
    totalRealizedGains: number;    // 총 실현 수익
    totalUnrealizedGains: number;  // 총 미실현 수익
    totalReturnRate: number;       // 전체 수익률
    initialInvestment: number;     // 초기 투자금
    currentPortfolioValue: number; // 현재 포트폴리오 가치
  };
}

interface PerformanceChartProps {
  user: any
  portfolio: any[]
}

const TIMEFRAMES = {
  '1M': '1분봉',
  '30M': '30분봉',
  '1H': '1시간봉',
  '1D': '1일봉',
  '7D': '7일봉'
} as const

export default function PerformanceChart({ user, portfolio }: PerformanceChartProps) {
  const [data, setData] = useState<Array<{ time: string; value: number }>>([])
  const [timeframe, setTimeframe] = useState('1M')
  const [isLoading, setIsLoading] = useState(true)
  const [hasNoData, setHasNoData] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    
    const fetchPerformance = async () => {
      try {
        setIsLoading(true)
        setHasNoData(false)
        const response = await fetch(`/api/stock/portfolio/performance?user_id=${user.id}&timeframe=${timeframe}`)
        const result = await response.json()
        
        if (!result.performance || result.performance.length === 0) {
          setHasNoData(true)
          setData([])
        } else {
          setData(result.performance)
        }
      } catch (error) {
        console.error('성과 데이터 로딩 오류:', error)
        setHasNoData(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPerformance()
  }, [timeframe, user?.id])

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">포트폴리오 수익률</h2>
          <div className="flex gap-2">
            {Object.entries(TIMEFRAMES).map(([tf, label]) => (
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
                {label}
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
          ) : hasNoData ? (
            <div className="flex flex-col h-full items-center justify-center gap-4">
              <span className="text-gray-400">
                선택한 시간대의 수익률 데이터가 없습니다
              </span>
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
                  tickFormatter={(value) => {
                    const num = parseFloat(value)
                    return isNaN(num) ? '0%' : `${num.toFixed(2)}%`
                  }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151', 
                    borderRadius: '0.375rem' 
                  }}
                  formatter={(value: number) => [`${value}%`, '수익률']}
                />
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
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
