'use client'

import { CardHeader, CardContent } from '@/components/ui/card'
import { TrophyIcon } from '@heroicons/react/24/solid'

export default function AchievementBadges() {
  // 예시 임시 업적 데이터 삭제
  const achievements: Array<{ id: number; title: string; description: string }> = [] // API 데이터로 대체 예정

  return (
    <div>
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-100">업적 뱃지</h2>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {achievements.map((badge) => (
            <div key={badge.id} className="flex flex-col items-center p-4 bg-gray-800 rounded">
              <TrophyIcon className="h-8 w-8 text-yellow-400" />
              <h3 className="mt-2 text-white font-bold">{badge.title}</h3>
              <p className="mt-1 text-gray-400 text-center text-sm">{badge.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </div>
  )
} 