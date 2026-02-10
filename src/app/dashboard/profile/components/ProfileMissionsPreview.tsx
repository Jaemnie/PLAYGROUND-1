'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Target, Calendar } from 'lucide-react'

interface Mission {
  id: string
  progress: number
  max_progress: number
  template: { name: string } | null
}

interface ProfileMissionsPreviewProps {
  missions: Mission[]
  checkIn: { streak?: number; checked_in_at?: string } | null
}

export function ProfileMissionsPreview({ missions, checkIn }: ProfileMissionsPreviewProps) {
  return (
    <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 h-full">
      <CardHeader className="pb-2">
        <h2 className="text-lg font-bold text-gray-100">미션 & 출석</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-400" />
            <span className="text-sm text-gray-400">출석 스트릭</span>
          </div>
          <span className="font-semibold text-gray-100">{checkIn?.streak ?? 0}일</span>
        </div>

        {missions.slice(0, 2).map((m) => {
          const pct = m.max_progress > 0 ? Math.min((m.progress / m.max_progress) * 100, 100) : 0
          return (
            <div key={m.id} className="p-3 rounded-lg bg-zinc-900/40">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-gray-200 truncate">
                  {m.template?.name ?? '미션'}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500/80 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {m.progress} / {m.max_progress}
              </p>
            </div>
          )
        })}

        {missions.length === 0 && (
          <p className="text-sm text-gray-500">진행 중인 미션이 없습니다</p>
        )}
      </CardContent>
    </Card>
  )
}
