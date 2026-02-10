'use client'

import { useMemo } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { motion } from 'framer-motion'
import { ChartPieIcon, LightBulbIcon } from '@heroicons/react/24/outline'

interface PortfolioDiversificationProps {
  portfolio: any[]
  /** 현재 시즌 테마의 산업 목록 (미보유 섹터 표시용). 없으면 보유 섹터만 표시 */
  availableSectors?: string[]
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#6366F1', '#14B8A6',
]

function getScoreTip(score: number, missingSectors: string[]): string {
  if (missingSectors.length === 5) return '주식을 매수하여 포트폴리오를 구성해 보세요.'
  if (score >= 70) return '훌륭한 다각화! 안정적인 포트폴리오입니다.'
  if (score >= 50) return '괜찮은 분산이지만, 더 넓게 투자하면 리스크를 줄일 수 있어요.'
  if (missingSectors.length >= 3) return `${missingSectors.slice(0, 2).join(', ')} 등 미투자 섹터를 고려해 보세요.`
  if (score >= 30) return '특정 섹터에 집중되어 있어요. 분산 투자를 고려해 보세요.'
  return '한 섹터에 쏠려 있어요! 다른 섹터에도 투자해 보세요.'
}

interface SectorHolding {
  name: string
  shares: number
  currentValue: number
  profitRate: number
}

interface SectorData {
  sector: string
  value: number
  percentage: number
  displayPercentage: number
  holdings: SectorHolding[]
  totalCost: number
  totalProfitRate: number
}

const tooltipKeyframes = `
@keyframes tooltipFadeIn {
  from { opacity: 0; transform: scale(0.95) translateY(4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
`

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload[0]) return null
  const data = payload[0].payload as SectorData
  const isProfit = data.totalProfitRate >= 0

  return (
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '0.5rem',
        padding: '10px 12px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        minWidth: '160px',
        maxWidth: '220px',
        animation: 'tooltipFadeIn 150ms ease-out',
      }}
    >
      {/* 섹터 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ color: '#e5e7eb', fontWeight: 700, fontSize: '13px' }}>{data.sector}</span>
        <span style={{ color: '#9ca3af', fontSize: '11px' }}>{data.percentage.toFixed(1)}%</span>
      </div>

      {/* 평가액 + 수익률 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ color: '#d1d5db', fontSize: '12px' }}>
          {Math.floor(data.value).toLocaleString()}원
        </span>
        <span style={{ color: isProfit ? '#4ade80' : '#f87171', fontSize: '12px', fontWeight: 600 }}>
          {isProfit ? '+' : ''}{data.totalProfitRate.toFixed(1)}%
        </span>
      </div>

      {/* 종목별 디테일 */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px' }}>
        {data.holdings.map((h, i) => {
          const hProfit = h.profitRate >= 0
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
              <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                {h.name} <span style={{ color: '#6b7280' }}>{h.shares}주</span>
              </span>
              <span style={{ color: hProfit ? '#4ade80' : '#f87171', fontSize: '11px', fontWeight: 500 }}>
                {hProfit ? '+' : ''}{h.profitRate.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PortfolioDiversification({ portfolio, availableSectors = [] }: PortfolioDiversificationProps) {
  const diversificationData = useMemo((): SectorData[] => {
    const sectorMap = new Map<string, { value: number; cost: number; holdings: SectorHolding[] }>()

    portfolio.forEach(holding => {
      const sector = holding.company.industry
      const currentValue = holding.shares * holding.company.current_price
      const costBasis = holding.shares * (holding.average_cost || holding.company.current_price)
      const profitRate = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0

      const existing = sectorMap.get(sector) || { value: 0, cost: 0, holdings: [] }
      existing.value += currentValue
      existing.cost += costBasis
      existing.holdings.push({
        name: holding.company.name,
        shares: holding.shares,
        currentValue,
        profitRate,
      })
      sectorMap.set(sector, existing)
    })

    const totalValue = Array.from(sectorMap.values()).reduce((a, b) => a + b.value, 0)
    if (totalValue === 0) return []

    return Array.from(sectorMap.entries())
      .map(([sector, data]) => ({
        sector,
        value: data.value,
        percentage: (data.value / totalValue) * 100,
        displayPercentage: Math.max((data.value / totalValue) * 100, 3),
        holdings: data.holdings.sort((a, b) => b.currentValue - a.currentValue),
        totalCost: data.cost,
        totalProfitRate: data.cost > 0 ? ((data.value - data.cost) / data.cost) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [portfolio])

  const score = useMemo(() => {
    if (diversificationData.length === 0) return 0
    const hhi = diversificationData.reduce((sum, item) => sum + Math.pow(item.percentage / 100, 2), 0)
    return Math.round(Math.max(0, Math.min(100, (1 - hhi) * 100)))
  }, [diversificationData])

  const missingSectors = useMemo(() => {
    const ownedSectors = new Set(diversificationData.map(d => d.sector))
    return availableSectors.filter(s => !ownedSectors.has(s))
  }, [diversificationData, availableSectors])

  const hasHoldings = diversificationData.length > 0
  const tip = getScoreTip(score, missingSectors as unknown as string[])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: tooltipKeyframes }} />
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
                    content={<CustomTooltip />}
                    allowEscapeViewBox={{ x: true, y: true }}
                    offset={15}
                    isAnimationActive={true}
                    animationDuration={150}
                    animationEasing="ease-out"
                    wrapperStyle={{
                      transition: 'transform 120ms ease-out, opacity 120ms ease-out',
                      pointerEvents: 'none',
                      zIndex: 50,
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

        {/* 미보유 섹터 + 팁 */}
        <div className="mt-3 pt-3 border-t border-white/5">
          {hasHoldings && missingSectors.length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-gray-500">미보유 섹터</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {missingSectors.map(sector => (
                  <span
                    key={sector}
                    className="px-2 py-0.5 rounded-md text-xs text-gray-500 bg-white/5 border border-white/5 border-dashed"
                  >
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-start gap-1.5">
            <LightBulbIcon className="w-3.5 h-3.5 text-yellow-500/60 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">{tip}</p>
          </div>
        </div>
      </CardContent>
    </>
  )
}
