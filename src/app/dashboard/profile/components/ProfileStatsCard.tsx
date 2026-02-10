'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  TrendingUp,
  TrendingDown,
  Flame,
  BarChart3,
  Calendar,
  Layers,
} from 'lucide-react'

interface UserStats {
  total_trades?: number
  total_profit_trades?: number
  total_loss_trades?: number
  max_profit_streak?: number
  max_portfolio_value?: number
  login_streak?: number
  unique_stocks_traded?: number
}

interface ProfileStatsCardProps {
  stats: UserStats | null
}

export function ProfileStatsCard({ stats }: ProfileStatsCardProps) {
  const s = stats || {}

  const items = [
    { icon: BarChart3, label: '총 거래', value: (s.total_trades ?? 0).toLocaleString() },
    { icon: TrendingUp, label: '수익 거래', value: (s.total_profit_trades ?? 0).toLocaleString() },
    { icon: TrendingDown, label: '손실 거래', value: (s.total_loss_trades ?? 0).toLocaleString() },
    { icon: Flame, label: '최대 수익 스트릭', value: (s.max_profit_streak ?? 0).toString() },
    { icon: BarChart3, label: '최대 포트폴리오', value: `${Math.round((s.max_portfolio_value ?? 0) / 1_000_000)}M P` },
    { icon: Calendar, label: '출석 스트릭', value: (s.login_streak ?? 0).toString() },
    { icon: Layers, label: '거래 종목 수', value: (s.unique_stocks_traded ?? 0).toString() },
  ]

  return (
    <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 h-full">
      <CardHeader className="pb-2">
        <h2 className="text-lg font-bold text-gray-100">핵심 통계</h2>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {items.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/40"
            >
              <Icon className="w-4 h-4 text-gray-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 truncate">{label}</p>
                <p className="text-sm font-semibold text-gray-200 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
