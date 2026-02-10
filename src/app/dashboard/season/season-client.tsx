'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Clock, Trophy, Gem, Lock, CheckCircle2 } from 'lucide-react'
import { TierBadge } from '@/components/ui/tier-badge'

interface SeasonTheme {
  name: string
  description: string
  color: string
  theme_code: string
}

interface Season {
  id: string
  season_number: number
  starts_at: string
  ends_at: string
  status: string
  theme: SeasonTheme
}

interface Participation {
  season_points: number
  total_trades: number
  pass_level: number
  pass_xp: number
  is_premium_pass: boolean
}

interface SeasonLeaderboardEntry {
  user_id: string
  season_points: number
  nickname: string
}

interface GlobalLeaderboardEntry {
  id: string
  nickname: string
  points: number
  stock_value: number
  total_capital: number
  tier: string
  division: number
}

interface PassReward {
  level: number
  free_reward: unknown
  premium_reward: unknown
}

interface SeasonClientProps {
  season: Season | null
  participation: Participation | null
  seasonLeaderboard: SeasonLeaderboardEntry[]
  globalLeaderboard: GlobalLeaderboardEntry[]
  pastSeasons: Season[]
  passRewards: PassReward[]
  userId: string
}

type LeaderboardTab = 'season' | 'global'

export function SeasonClient({
  season,
  participation,
  seasonLeaderboard,
  globalLeaderboard,
  pastSeasons,
  passRewards,
  userId,
}: SeasonClientProps) {
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>('season')
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    if (!season) return
    const timer = setInterval(() => {
      const now = new Date()
      const end = new Date(season.ends_at)
      const diff = end.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('시즌 종료!')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeLeft(`${days}일 ${hours}시간 ${minutes}분`)
    }, 1000)

    return () => clearInterval(timer)
  }, [season])

  const themeColor = season?.theme?.color || '#8B5CF6'

  if (!season) {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed top-4 left-4 z-50">
          <Button
            type="button"
            className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70 flex items-center gap-2"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
            <span className="text-zinc-200">대시보드</span>
          </Button>
        </div>
        <section className="pt-20 pb-8 px-4">
          <div className="container mx-auto max-w-5xl">
            <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">STACKS</p>
            <h1 className="text-2xl font-bold text-gray-100">시즌 & 랭킹</h1>
            <p className="text-sm text-gray-500 mt-2">현재 활성 시즌이 없습니다. 전체 랭킹을 확인하세요.</p>
          </div>
        </section>
        <section className="px-4 pb-12">
          <div className="container mx-auto max-w-5xl">
            <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">전체 랭킹</h2>
              {globalLeaderboard.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">랭킹 데이터가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {globalLeaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        entry.id === userId ? 'bg-white/5 border border-white/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 text-center font-bold ${
                          index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-200">{entry.nickname}</span>
                        <TierBadge tier={entry.tier} division={entry.division} size="sm" />
                        {entry.id === userId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">나</span>
                        )}
                      </div>
                      <span className="text-sm font-mono text-gray-300">
                        {Math.round(entry.total_capital).toLocaleString()}P
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </section>
      </div>
    )
  }

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

      {/* 시즌 헤더 */}
      <section className="pt-20 pb-6 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: themeColor }}
              />
              <p className="text-sm font-bold tracking-widest" style={{ color: themeColor }}>
                시즌 {season.season_number}
              </p>
            </div>
            <h1 className="text-3xl font-bold text-gray-100 mb-1">{season.theme.name}</h1>
            <p className="text-sm text-gray-400 mb-4">{season.theme.description}</p>

            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-sm text-gray-300">
                <Clock className="w-4 h-4" />
                남은 시간: {timeLeft}
              </span>
              {participation && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: themeColor }}>
                  <Gem className="w-4 h-4" />
                  {Math.round(participation.season_points).toLocaleString()}P
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 내 현황 */}
      {participation && (
        <section className="px-4 pb-4">
          <div className="container mx-auto max-w-5xl">
            <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">내 시즌 현황</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">시즌 자산</p>
                  <p className="text-lg font-bold text-gray-100">
                    {Math.round(participation.season_points).toLocaleString()}P
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">거래 횟수</p>
                  <p className="text-lg font-bold text-gray-100">{participation.total_trades}회</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">패스 레벨</p>
                  <p className="text-lg font-bold" style={{ color: themeColor }}>
                    Lv.{participation.pass_level}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">패스 XP</p>
                  <p className="text-lg font-bold text-gray-100">
                    {participation.pass_xp} / 100
                  </p>
                </div>
              </div>

              {/* 패스 XP 바 */}
              <div className="mt-4">
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${participation.pass_xp}%`, backgroundColor: themeColor }}
                  />
                </div>
              </div>

              {/* 프리미엄 패스 */}
              {!participation.is_premium_pass && (
                <div className="mt-4 p-3 rounded-xl border border-dashed" style={{ borderColor: `${themeColor}50` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-200">프리미엄 패스</p>
                      <p className="text-xs text-gray-500">한정 코스메틱 + 추가 보상 해금</p>
                    </div>
                    <Button size="sm" style={{ backgroundColor: themeColor }}>
                      <Gem className="w-3 h-3 mr-1" />
                      500젬
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </section>
      )}

      {/* 랭킹 (시즌 / 전체 탭) */}
      <section className="px-4 pb-4">
        <div className="container mx-auto max-w-5xl">
          <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5" style={{ color: themeColor }} />
                <h2 className="text-lg font-semibold text-gray-100">랭킹</h2>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('season')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    leaderboardTab === 'season'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800/60 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  시즌 랭킹
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('global')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    leaderboardTab === 'global'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800/60 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  전체 랭킹
                </button>
              </div>
            </div>

            {leaderboardTab === 'season' ? (
              seasonLeaderboard.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">아직 참가자가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {seasonLeaderboard.map((entry, index) => (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        entry.user_id === userId ? 'bg-white/5 border border-white/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 text-center font-bold ${
                          index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-200">{entry.nickname}</span>
                        {entry.user_id === userId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">나</span>
                        )}
                      </div>
                      <span className="text-sm font-mono text-gray-300">
                        {Math.round(entry.season_points).toLocaleString()}P
                      </span>
                    </motion.div>
                  ))}
                </div>
              )
            ) : (
              globalLeaderboard.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">랭킹 데이터가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {globalLeaderboard.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        entry.id === userId ? 'bg-white/5 border border-white/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 text-center font-bold ${
                          index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-200">{entry.nickname}</span>
                        <TierBadge tier={entry.tier} division={entry.division} size="sm" />
                        {entry.id === userId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">나</span>
                        )}
                      </div>
                      <span className="text-sm font-mono text-gray-300">
                        {Math.round(entry.total_capital).toLocaleString()}P
                      </span>
                    </motion.div>
                  ))}
                </div>
              )
            )}
          </Card>
        </div>
      </section>

      {/* 시즌 패스 트랙 */}
      {passRewards.length > 0 && (
        <section className="px-4 pb-4">
          <div className="container mx-auto max-w-5xl">
            <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">시즌 패스</h2>
              <div className="space-y-2">
                {passRewards.map(reward => {
                  const isUnlocked = participation ? participation.pass_level >= reward.level : false
                  const isPremium = participation?.is_premium_pass

                  return (
                    <div key={reward.level} className={`flex items-center gap-3 p-2 rounded-lg ${isUnlocked ? 'bg-white/5' : ''}`}>
                      <span className={`w-8 text-center text-sm font-bold ${isUnlocked ? 'text-gray-100' : 'text-gray-600'}`}>
                        {reward.level}
                      </span>
                      <div className="flex-1 flex items-center gap-2">
                        {/* 무료 보상 */}
                        <span className={`text-xs px-2 py-1 rounded ${isUnlocked ? 'bg-green-500/20 text-green-300' : 'bg-zinc-800 text-zinc-500'}`}>
                          {isUnlocked ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : null}
                          무료: {JSON.stringify(reward.free_reward)}
                        </span>
                        {/* 프리미엄 보상 */}
                        <span className={`text-xs px-2 py-1 rounded ${
                          isUnlocked && isPremium ? 'bg-violet-500/20 text-violet-300' :
                          !isPremium ? 'bg-zinc-800/50 text-zinc-600' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {!isPremium ? <Lock className="w-3 h-3 inline mr-1" /> : isUnlocked ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : null}
                          프리미엄: {JSON.stringify(reward.premium_reward)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* 과거 시즌 */}
      {pastSeasons.length > 0 && (
        <section className="px-4 pb-12">
          <div className="container mx-auto max-w-5xl">
            <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">지난 시즌</h2>
              <div className="space-y-2">
                {pastSeasons.map(ps => (
                  <div key={ps.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ps.theme.color }} />
                      <span className="text-sm text-gray-300">
                        시즌 {ps.season_number}: {ps.theme.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">종료</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      )}
    </div>
  )
}
