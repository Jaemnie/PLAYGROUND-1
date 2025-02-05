'use client'

import { CardHeader, CardContent } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface PerformanceChartProps {
  portfolio: any[]
}

export default function PerformanceChart({ portfolio }: PerformanceChartProps) {
  // 임시 데이터 생성 로직 삭제
  // 실제 API에서 받은 데이터를 사용하도록 수정 예정
  const data: Array<{ time: string; value: number }> = [] 

  return (
    <>
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-100">포트폴리오 수익률</h2>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="time" stroke="#4B5563" tick={{ fill: '#9CA3AF' }} />
              <YAxis stroke="#4B5563" tick={{ fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.375rem' }} />
              <Line type="monotone" dataKey="value" stroke="#60A5FA" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </>
  )
}
