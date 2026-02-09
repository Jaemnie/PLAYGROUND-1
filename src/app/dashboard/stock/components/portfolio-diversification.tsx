'use client'

import { useMemo } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { motion } from 'framer-motion'
import { ChartPieIcon } from '@heroicons/react/24/outline'

interface PortfolioDiversificationProps {
  portfolio: any[]
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#6366F1', '#14B8A6',
]

export function PortfolioDiversification({ portfolio }: PortfolioDiversificationProps) {
  const diversificationData = useMemo(() => {
    const sectorMap = new Map<string, number>()
    portfolio.forEach(holding => {
      const sector = holding.company.industry
      const value = holding.shares * holding.company.current_price
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + value)
    })
    const totalValue = Array.from(sectorMap.values()).reduce((a, b) => a + b, 0)
    if (totalValue === 0) return []
    return Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        sector,
        value,
        percentage: (value / totalValue) * 100,
        displayPercentage: Math.max((value / totalValue) * 100, 3),
      }))
      .sort((a, b) => b.value - a.value)
  }, [portfolio])

  const score = useMemo(() => {
    if (diversificationData.length === 0) return 0
    const hhi = diversificationData.reduce((sum, item) => sum + Math.pow(item.percentage / 100, 2), 0)
    return Math.round(Math.max(0, Math.min(100, (1 - hhi) * 100)))
  }, [diversificationData])

  const hasHoldings = diversificationData.length > 0

  return (
    <>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChartPieIcon className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              포트폴리오 다각화
            </h2>
          </div>
          {hasHoldings && (
            <span className={`text-xs font-bold ${score >= 60 ? 'text-green-400' : score >= 35 ? 'text-yellow-400' : 'text-red-400'}`}>
              {score}점
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasHoldings ? (
          <div className="text-center py-4 text-sm text-gray-500">보유 종목이 없습니다</div>
        ) : (
          <div className="flex items-center gap-4">
            {/* 미니 파이 차트 */}
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={diversificationData}
                    dataKey="displayPercentage"
                    cx="50%"
                    cy="50%"
                    innerRadius={18}
                    outerRadius={42}
                    paddingAngle={2}
                    minAngle={10}
                  >
                    {diversificationData.map((entry, index) => (
                      <Cell key={entry.sector} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | string, name: string, props: any) => [
                      `${props.payload.percentage.toFixed(1)}%`,
                      props.payload.sector,
                    ]}
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '0.375rem',
                      fontSize: '12px',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 섹터 리스트 */}
            <div className="flex-1 space-y-1">
              {diversificationData.map((item, index) => (
                <motion.div
                  key={item.sector}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between h-5"
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs text-gray-300">{item.sector}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-400 tabular-nums">
                    {item.percentage.toFixed(1)}%
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </>
  )
}
