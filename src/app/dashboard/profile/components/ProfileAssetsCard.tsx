'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Gem, Banknote } from 'lucide-react'
import Link from 'next/link'

interface ProfileAssetsCardProps {
  points: number
  gems: number
}

export function ProfileAssetsCard({ points, gems }: ProfileAssetsCardProps) {
  return (
    <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 h-full">
      <CardHeader className="pb-2">
        <h2 className="text-lg font-bold text-gray-100">자산</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-gray-400">포인트</span>
          </div>
          <span className="font-semibold text-gray-100">
            {Math.round(points ?? 0).toLocaleString()} P
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-gray-400">젬</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-300">
              {Math.round(gems ?? 0).toLocaleString()}
            </span>
            <Link
              href="/dashboard/shop"
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              상점 →
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
