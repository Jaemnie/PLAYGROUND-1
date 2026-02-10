'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Trophy, Star, Crown, Gem, HelpCircle, Lock,
  Footprints, Repeat, Award, Zap, HandCoins, TrendingUp,
  Flame, Fire, Bomb, ThumbsUp, Target, Banknote, ShoppingCart,
  PieChart, Layers, Coins, Boxes, Compass, LayoutGrid,
  UserPlus, Users, UserCheck, MessageCircle, MessageSquare, MessagesSquare,
  Map, Newspaper, BookOpen, Calendar, CalendarCheck,
  ShoppingBag, TrendingDown, Shield, RotateCcw, Swords,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, Star, Crown, Gem, HelpCircle, Lock,
  Footprints, Repeat, Award, Zap, HandCoins, TrendingUp,
  Flame, Fire, Bomb, ThumbsUp, Target, Banknote, ShoppingCart,
  PieChart, Layers, Coins, Boxes, Compass, LayoutGrid,
  UserPlus, Users, UserCheck, MessageCircle, MessageSquare, MessagesSquare,
  Map, Newspaper, BookOpen, Calendar, CalendarCheck,
  ShoppingBag, TrendingDown, Shield, RotateCcw, Swords,
  Milestone: Award,
}

interface Achievement {
  id: string
  code: string
  name: string
  description: string
  category: string
  icon: string
  rarity: string
  is_hidden: boolean
  progress: number
  max_progress: number
  unlocked_at: string | null
  reward_gems: number
  reward_title: { name: string; rarity: string } | null
}

interface AchievementsClientProps {
  achievements: Achievement[]
  gems: number
}

const categories = [
  { key: 'all', label: '전체' },
  { key: 'trading', label: '트레이딩' },
  { key: 'portfolio', label: '포트폴리오' },
  { key: 'social', label: '소셜' },
  { key: 'exploration', label: '탐험' },
  { key: 'market', label: '시장' },
]

const rarityColors: Record<string, { bg: string; border: string; text: string }> = {
  common: { bg: 'bg-zinc-800/60', border: 'border-zinc-700/50', text: 'text-zinc-300' },
  rare: { bg: 'bg-blue-900/30', border: 'border-blue-700/50', text: 'text-blue-300' },
  epic: { bg: 'bg-purple-900/30', border: 'border-purple-700/50', text: 'text-purple-300' },
  legendary: { bg: 'bg-amber-900/30', border: 'border-amber-700/50', text: 'text-amber-300' },
}

const rarityLabels: Record<string, string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
}

export function AchievementsClient({ achievements, gems }: AchievementsClientProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('all')

  const filtered = selectedCategory === 'all'
    ? achievements
    : achievements.filter((a) => a.category === selectedCategory)

  const unlockedCount = achievements.filter((a) => a.unlocked_at).length
  const totalCount = achievements.length

  return (
    <div className="min-h-screen bg-background">
      {/* 뒤로가기 */}
      <div className="fixed top-4 left-4 z-50">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Button
            type="button"
            className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70 flex items-center gap-2"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
            <span className="text-zinc-200">대시보드</span>
          </Button>
        </motion.div>
      </div>

      {/* 헤더 */}
      <section className="pt-20 pb-4 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">STACKS</p>
            <h1 className="text-2xl font-bold text-gray-100">업적</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-gray-400">
                {unlockedCount} / {totalCount} 달성
              </span>
              <span className="flex items-center gap-1 text-sm text-amber-300">
                <Gem className="w-4 h-4" />
                {gems.toLocaleString()} 젬
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 카테고리 탭 */}
      <section className="px-4 pb-2">
        <div className="container mx-auto max-w-5xl">
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.key
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800/60 text-gray-400 hover:text-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 업적 그리드 */}
      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((achievement, index) => {
              const isUnlocked = !!achievement.unlocked_at
              const colors = rarityColors[achievement.rarity] || rarityColors.common
              const IconComponent = iconMap[achievement.icon] || HelpCircle
              const progressPct = achievement.max_progress > 0
                ? Math.min((achievement.progress / achievement.max_progress) * 100, 100)
                : 0

              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                >
                  <Card
                    className={`
                      rounded-xl border backdrop-blur-sm p-4 transition-all
                      ${isUnlocked ? colors.bg : 'bg-zinc-900/40'}
                      ${isUnlocked ? colors.border : 'border-zinc-800/40'}
                      ${isUnlocked ? '' : 'opacity-70'}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* 아이콘 */}
                      <div className={`
                        flex items-center justify-center w-10 h-10 rounded-lg shrink-0
                        ${isUnlocked ? 'bg-white/10' : 'bg-zinc-800/60'}
                      `}>
                        {isUnlocked ? (
                          <IconComponent className={`w-5 h-5 ${colors.text}`} />
                        ) : (
                          <Lock className="w-5 h-5 text-zinc-600" />
                        )}
                      </div>

                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className={`text-sm font-bold truncate ${isUnlocked ? 'text-gray-100' : 'text-gray-500'}`}>
                            {achievement.name}
                          </h3>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                            isUnlocked ? `bg-white/10 ${colors.text}` : 'bg-zinc-800 text-zinc-600'
                          }`}>
                            {rarityLabels[achievement.rarity]}
                          </span>
                        </div>
                        <p className={`text-xs mb-2 ${isUnlocked ? 'text-gray-400' : 'text-gray-600'}`}>
                          {achievement.description}
                        </p>

                        {/* 진행도 바 */}
                        {!isUnlocked && (
                          <div className="mb-1.5">
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                              <span>{achievement.progress} / {achievement.max_progress}</span>
                              <span>{Math.round(progressPct)}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-violet-500/80 rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* 보상 */}
                        <div className="flex items-center gap-2">
                          {achievement.reward_gems > 0 && (
                            <span className={`flex items-center gap-1 text-[10px] ${isUnlocked ? 'text-amber-300' : 'text-zinc-600'}`}>
                              <Gem className="w-3 h-3" />
                              {achievement.reward_gems} 젬
                            </span>
                          )}
                          {achievement.reward_title && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isUnlocked ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800 text-zinc-600'}`}>
                              칭호: {achievement.reward_title.name}
                            </span>
                          )}
                          {isUnlocked && (
                            <span className="text-[10px] text-green-400 ml-auto">
                              달성 완료
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
