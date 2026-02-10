'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import DashboardBackButton from '@/components/DashboardBackButton'
import { User } from '@supabase/supabase-js'
import { ProfileHeader } from './ProfileHeader'
import { ProfileAssetsCard } from './ProfileAssetsCard'
import { ProfileStatsCard } from './ProfileStatsCard'
import { ProfileAchievementsPreview } from './ProfileAchievementsPreview'
import { ProfileMissionsPreview } from './ProfileMissionsPreview'
import { ProfileSeasonPreview } from './ProfileSeasonPreview'
import { ProfileInfoCard } from './ProfileInfoCard'

interface Profile {
  nickname: string
  points: number
  gems?: number
  created_at: string
  equipped_title_id?: string | null
  equipped_frame?: string | null
  nickname_color?: string | null
  equipped_badge?: string | null
}

interface UserRank {
  tier: string
  division?: number
}

interface UserStats {
  total_trades?: number
  total_profit_trades?: number
  total_loss_trades?: number
  max_profit_streak?: number
  max_portfolio_value?: number
  login_streak?: number
  unique_stocks_traded?: number
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

interface ShopItem {
  code: string
  category: string
  preview_data: { color?: string; gradient?: string; icon?: string } | null
}

interface Mission {
  id: string
  progress: number
  max_progress: number
  template: { name: string } | null
}

interface CheckIn {
  streak?: number
  checked_in_at?: string
}

interface Season {
  id: string
  season_number?: number
  theme?: { name: string; theme_code?: string } | null
}

interface Participation {
  season_points?: number
  pass_level?: number
}

interface ProfileClientProps {
  user: User
  profile: Profile | null
  userRank: UserRank | null
  userStats: UserStats | null
  achievements: Achievement[]
  equippedTitle: { name: string; rarity: string } | null
  shopItems: ShopItem[]
  missions: Mission[]
  checkIn: CheckIn | null
  season: Season | null
  participation: Participation | null
}

export function ProfileClient({
  user,
  profile,
  userRank,
  userStats,
  achievements,
  equippedTitle,
  shopItems,
  missions,
  checkIn,
  season,
  participation,
}: ProfileClientProps) {
  const [nickname, setNickname] = useState(profile?.nickname ?? '')

  const handleNicknameUpdate = (newNickname: string) => {
    setNickname(newNickname)
  }

  const p = profile ?? { nickname: '', points: 0, gems: 0, created_at: new Date().toISOString() }
  const rank = userRank ?? { tier: 'bronze', division: 3 }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>

      {/* 헤더 */}
      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">STACKS</p>
            <h1 className="text-2xl font-bold text-gray-100">내 프로필</h1>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-6">
            {/* 프로필 헤더 */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <ProfileHeader
                nickname={nickname}
                equippedTitle={equippedTitle}
                equippedFrame={p.equipped_frame ?? null}
                nicknameColor={p.nickname_color ?? null}
                equippedBadge={p.equipped_badge ?? null}
                tier={rank.tier}
                division={rank.division}
                shopItems={shopItems}
              />
            </motion.div>

            {/* 자산 + 통계 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <ProfileAssetsCard points={p.points ?? 0} gems={p.gems ?? 0} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <ProfileStatsCard stats={userStats} />
              </motion.div>
            </div>

            {/* 업적 미리보기 */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <ProfileAchievementsPreview achievements={achievements} />
            </motion.div>

            {/* 미션 + 시즌 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <ProfileMissionsPreview missions={missions} checkIn={checkIn} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <ProfileSeasonPreview season={season} participation={participation} />
              </motion.div>
            </div>

            {/* 프로필 정보 */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <ProfileInfoCard
                email={user.email ?? ''}
                nickname={nickname}
                createdAt={p.created_at}
                userId={user.id}
                onNicknameUpdate={handleNicknameUpdate}
              />
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
