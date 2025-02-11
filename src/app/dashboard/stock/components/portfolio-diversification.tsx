'use client'

import { useMemo } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'

interface PortfolioDiversificationProps {
  portfolio: any[]
}

const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
]

interface DiversificationMetrics {
  herfindahlIndex: number;
  topSectorWeight: number;
  sectorCount: number;
}

function calculateDiversificationMetrics(data: Array<{ percentage: number }>): DiversificationMetrics {
  // 허핀달 지수 계산 (시장 집중도를 나타내는 지표)
  const herfindahlIndex = data.reduce((sum, item) => sum + Math.pow(item.percentage / 100, 2), 0)
  
  // 최대 섹터 비중
  const topSectorWeight = data.length > 0 ? data[0].percentage : 0
  
  // 투자된 섹터 수
  const sectorCount = data.length

  return {
    herfindahlIndex,
    topSectorWeight,
    sectorCount
  }
}

function getDiversificationScore(metrics: DiversificationMetrics): {
  score: number;
  status: 'high' | 'medium' | 'low';
  message: string;
} {
  const { herfindahlIndex, sectorCount } = metrics
  
  // 다각화 점수 계산 (0-100)
  const score = Math.max(0, Math.min(100, (1 - herfindahlIndex) * 100))
  
  if (score >= 75 && sectorCount >= 4) {
    return {
      score,
      status: 'high',
      message: '포트폴리오가 잘 분산되어 있습니다.'
    }
  } else if (score >= 50 && sectorCount >= 3) {
    return {
      score,
      status: 'medium',
      message: '적절한 수준의 분산투자가 이루어졌습니다.'
    }
  } else {
    return {
      score,
      status: 'low',
      message: '포트폴리오 다각화가 필요합니다.'
    }
  }
}

// 원형 그래프의 각 섹터에 분포도를 표시하기 위한 라벨 렌더러
function renderCustomizedLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  value,
  payload
}: {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  percent: number;
  value: number;
  payload: any;
}) {
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 40
  
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  
  const isRightSide = x > cx
  const verticalAdjust = Math.abs(Math.sin(-midAngle * RADIAN)) * 10

  return (
    <g>
      <path
        d={`M ${cx + (outerRadius + 5) * Math.cos(-midAngle * RADIAN)},
           ${cy + (outerRadius + 5) * Math.sin(-midAngle * RADIAN)}
           L ${cx + (radius - 20) * Math.cos(-midAngle * RADIAN)},
           ${cy + (radius - 20) * Math.sin(-midAngle * RADIAN)}
           L ${x},${y}`}
        stroke="#4B5563"
        fill="none"
        strokeWidth={1}
      />
      <text
        x={x + (isRightSide ? 5 : -5)}
        y={y - 10 + verticalAdjust}
        textAnchor={isRightSide ? "start" : "end"}
        fill="#9CA3AF"
        fontSize="12"
      >
        {Math.floor(payload.value).toLocaleString()}원
      </text>
      <text
        x={x + (isRightSide ? 5 : -5)}
        y={y + 10 + verticalAdjust}
        textAnchor={isRightSide ? "start" : "end"}
        fill="#6B7280"
        fontSize="12"
        fontWeight="600"
      >
        {payload.percentage.toFixed(1)}%
      </text>
    </g>
  )
}

export function PortfolioDiversification({ portfolio }: PortfolioDiversificationProps) {
  const diversificationData = useMemo(() => {
    const sectorMap = new Map<string, number>()
    
    // 섹터별 총 투자금액 계산
    portfolio.forEach(holding => {
      const sector = holding.company.industry
      const value = holding.shares * holding.company.current_price
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + value)
    })
    
    // 총 포트폴리오 가치
    const totalValue = Array.from(sectorMap.values()).reduce((a, b) => a + b, 0)
    
    // 차트 데이터 구성 및 작은 비율 처리
    return Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        sector,
        value,
        percentage: (value / totalValue) * 100,
        // 시각적 표현을 위한 최소 각도 보장
        displayPercentage: Math.max((value / totalValue) * 100, 1)
      }))
      .sort((a, b) => b.value - a.value)
  }, [portfolio])

  const metrics = useMemo(() => 
    calculateDiversificationMetrics(diversificationData),
    [diversificationData]
  )

  const diversificationScore = useMemo(() => 
    getDiversificationScore(metrics),
    [metrics]
  )

  const statusColors = {
    high: 'text-green-400',
    medium: 'text-yellow-400',
    low: 'text-red-400'
  }

  const StatusIcon = {
    high: CheckCircle,
    medium: Info,
    low: AlertTriangle
  }[diversificationScore.status]

  // 집중 투자 위험 체크 (한 섹터가 50% 이상인 경우)
  const hasConcentrationRisk = diversificationData.some(item => item.percentage > 50)

  return (
    <>
      <CardHeader>
        <h2 className="text-xl font-bold text-gray-100">포트폴리오 다각화</h2>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 차트 영역 */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={diversificationData}
                  dataKey="displayPercentage"
                  nameKey="sector"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={100}
                  label={renderCustomizedLabel}
                  labelLine={false}
                  paddingAngle={2}
                  minAngle={15}
                >
                  {diversificationData.map((entry, index) => (
                    <Cell 
                      key={entry.sector} 
                      fill={COLORS[index % COLORS.length]}
                      stroke="transparent"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => {
                    // 실제 값과 퍼센트를 표시
                    return [
                      `${Math.floor(props.payload.value).toLocaleString()}원 (${props.payload.percentage.toFixed(1)}%)`,
                      props.payload.sector
                    ]
                  }}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.375rem',
                    color: '#ffffff'
                  }}
                  labelStyle={{ color: '#ffffff' }}
                  itemStyle={{ color: '#ffffff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 섹터 분포 목록 - 실제 퍼센트 값 표시 */}
          <div className="space-y-3">
            {diversificationData.map((item, index) => (
              <motion.div
                key={item.sector}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-300">{item.sector}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-400">
                    {item.percentage.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500">
                    {Math.floor(item.value).toLocaleString()}원
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* 다각화 분석 */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon className={`w-5 h-5 ${statusColors[diversificationScore.status]}`} />
                <h3 className="font-semibold text-gray-200">다각화 점수</h3>
              </div>
              <div className="text-2xl font-bold text-gray-100 mb-2">
                {Math.round(diversificationScore.score)}/100
              </div>
              <p className={`text-sm ${statusColors[diversificationScore.status]}`}>
                {diversificationScore.message}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">투자 섹터 수</span>
                <span className="text-sm font-medium text-gray-300">
                  {metrics.sectorCount}개
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">최대 섹터 비중</span>
                <span className="text-sm font-medium text-gray-300">
                  {metrics.topSectorWeight.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">집중도 지수</span>
                <span className="text-sm font-medium text-gray-300">
                  {(metrics.herfindahlIndex * 100).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 집중 투자 경고 */}
        {hasConcentrationRisk && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <p className="text-sm text-red-400">
              특정 섹터에 집중 투자된 상태입니다. 위험 분산을 위해 다른 섹터 투자를 고려해보세요.
            </p>
          </motion.div>
        )}
      </CardContent>
    </>
  )
} 