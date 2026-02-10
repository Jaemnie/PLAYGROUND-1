'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Trophy, Star, Crown, Gem, HelpCircle, Lock, Flame, Award, Zap,
  HandCoins, TrendingUp, ThumbsUp, Target, Banknote, ShoppingCart,
  PieChart, Layers, Coins, Boxes, Compass, LayoutGrid,
  UserPlus, Users, UserCheck, MessageCircle, MessageSquare, MessagesSquare,
  Map, Newspaper, BookOpen, Calendar, CalendarCheck,
  ShoppingBag, TrendingDown, Shield, RotateCcw, Swords,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, Star, Crown, Gem, HelpCircle, Lock, Flame, Award, Zap,
  HandCoins, TrendingUp, ThumbsUp, Target, Banknote, ShoppingCart,
  PieChart, Layers, Coins, Boxes, Compass, LayoutGrid,
  UserPlus, Users, UserCheck, MessageCircle, MessageSquare, MessagesSquare,
  Map, Newspaper, BookOpen, Calendar, CalendarCheck,
  ShoppingBag, TrendingDown, Shield, RotateCcw, Swords,
  Fire: Flame, Milestone: Award,
}

interface Achievement {
  id: string
  name: string
  icon: string
  rarity: string
  progress: number
  max_progress: number
  unlocked_at: string | null
}

interface ProfileAchievementsPreviewProps {
  achievements: Achievement[]
}

export function ProfileAchievementsPreview({ achievements }: ProfileAchievementsPreviewProps) {
  const router = useRouter()

  const unlocked = achievements.filter((a) => a.unlocked_at)
  const inProgress = achievements
    .filter((a) => !a.unlocked_at)
    .sort((a, b) => {
      const pctA = a.max_progress > 0 ? a.progress / a.max_progress : 0
      const pctB = b.max_progress > 0 ? b.progress / b.max_progress : 0
      return pctB - pctA
    })

  const display = [...unlocked.slice(0, 2), ...inProgress.slice(0, 3)].slice(0, 5)

  return (
    <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="text-lg font-bold text-gray-100">업적</h2>
        <button
          type="button"
          onClick={() => router.push('/dashboard/achievements')}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          전체 보기 →
        </button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {display.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">아직 업적이 없습니다</p>
          ) : (
            display.map((a, i) => {
              const isUnlocked = !!a.unlocked_at
              const IconComponent = iconMap[a.icon] || HelpCircle
              const progressPct = a.max_progress > 0 ? Math.min((a.progress / a.max_progress) * 100, 100) : 0

              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/40"
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isUnlocked ? 'bg-white/10' : 'bg-zinc-800'}`}>
                    {isUnlocked ? (
                      <IconComponent className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isUnlocked ? 'text-gray-200' : 'text-gray-500'}`}>
                      {a.name}
                    </p>
                    {!isUnlocked && (
                      <div className="mt-1">
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-500/80 rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {a.progress} / {a.max_progress}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
