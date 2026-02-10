'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { Swords } from 'lucide-react'

interface SeasonTheme {
  name: string
  theme_code?: string
}

interface Season {
  id: string
  season_number?: number
  theme?: SeasonTheme | null
}

interface Participation {
  season_points?: number
  pass_level?: number
}

interface ProfileSeasonPreviewProps {
  season: Season | null
  participation: Participation | null
}

export function ProfileSeasonPreview({ season, participation }: ProfileSeasonPreviewProps) {
  const router = useRouter()

  if (!season) {
    return (
      <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 h-full">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-bold text-gray-100">시즌</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">현재 진행 중인 시즌이 없습니다</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="text-lg font-bold text-gray-100">시즌</h2>
        <button
          type="button"
          onClick={() => router.push('/dashboard/season')}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          상세 →
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-violet-400" />
          <span className="text-sm font-medium text-gray-200">
            {season.theme?.name ?? `시즌 ${season.season_number ?? '-'}`}
          </span>
        </div>
        {participation && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">시즌 포인트</span>
              <span className="text-gray-200 font-medium">
                {Math.round(participation.season_points ?? 0).toLocaleString()} P
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">패스 레벨</span>
              <span className="text-gray-200 font-medium">{participation.pass_level ?? 0}</span>
            </div>
          </div>
        )}
        {!participation && (
          <p className="text-sm text-gray-500">시즌에 참여해보세요</p>
        )}
      </CardContent>
    </Card>
  )
}
