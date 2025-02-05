'use client'

import { CardHeader, CardContent } from '@/components/ui/card'

interface PerformanceComparisonProps {
  performanceRanking: any[]
}

export default function PerformanceComparison({ performanceRanking }: PerformanceComparisonProps) {
  // 평균 수익률 계산 (상위 순위 데이터를 기반으로)
  const avgGain =
    performanceRanking.reduce((sum, user) => sum + (user.gain_percentage || 0), 0) /
    (performanceRanking.length || 1)

  return (
    <>
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-100">성과 비교</h2>
      </CardHeader>
      <CardContent>
        <p className="text-gray-300">평균 수익률: {avgGain.toFixed(2)}%</p>
        {/* 추가 비교 요소를 여기에 추가할 수 있습니다 */}
      </CardContent>
    </>
  )
} 