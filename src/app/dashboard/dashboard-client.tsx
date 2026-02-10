'use client'

import { motion } from 'framer-motion'
import {
  BarChart3,
  Trophy,
  Users2,
  UserCircle,
  MessageSquare,
  ArrowRight,
  Award,
  Store,
  Swords,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'

interface DashboardClientProps {
  user: { id: string }
  profile: { nickname?: string; friends?: number }
  friendRequestCount?: number
}

export function DashboardClient({ 
  profile, 
  friendRequestCount = 0,
}: DashboardClientProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <LogoutButton />
      </div>
      
      {/* 컴팩트 헤더 */}
      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end justify-between"
          >
            <div>
              <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">
                STACKS
              </p>
              <h1 className="text-2xl font-bold text-gray-100">
                안녕하세요, {profile.nickname || '사용자'} 님
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                오늘도 현명한 투자를 시작해보세요.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-none md:grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 auto-rows-[180px] md:auto-rows-auto">

            {/* 주식 시뮬레이션 - Featured 2x2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              onClick={() => router.push('/dashboard/stock')}
              className="col-span-1 md:col-span-2 md:row-span-2 cursor-pointer group"
            >
              <div className="relative h-full overflow-hidden rounded-2xl border border-gray-800/50 bg-gradient-to-br from-violet-950/40 via-black/60 to-blue-950/40 p-8 transition-all duration-300 group-hover:border-violet-500/30 group-hover:scale-[1.01]">
                {/* 배경 장식 */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
                
                <div className="relative flex flex-col justify-between h-full">
                  <div>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-6">
                      <BarChart3 className="h-6 w-6 text-violet-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-100 mb-2">
                      주식 시뮬레이션
                    </h2>
                    <p className="text-sm text-gray-400 max-w-sm">
                      가상 주식 시장에서 투자 감각을 키워보세요. 실시간 시세 확인, 매수/매도, 포트폴리오 관리까지.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-violet-400 group-hover:gap-3 transition-all duration-300 mt-6">
                    <span className="text-sm font-medium">시작하기</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 리더보드 - 1x1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => router.push('/dashboard/stock/leaderboard')}
              className="cursor-pointer group"
            >
              <div className="h-full rounded-2xl border border-gray-800/50 bg-black/40 backdrop-blur-sm p-6 transition-all duration-300 group-hover:border-gray-700/60 group-hover:bg-black/60 group-hover:scale-[1.02]">
                <div className="flex flex-col justify-between h-full">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Trophy className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-gray-100">리더보드</h3>
                    <p className="text-xs text-gray-500 mt-1">랭킹 및 업적을 확인하세요</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 내 프로필 - 1x1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => router.push('/dashboard/profile')}
              className="cursor-pointer group"
            >
              <div className="h-full rounded-2xl border border-gray-800/50 bg-black/40 backdrop-blur-sm p-6 transition-all duration-300 group-hover:border-gray-700/60 group-hover:bg-black/60 group-hover:scale-[1.02]">
                <div className="flex flex-col justify-between h-full">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <UserCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-gray-100">{profile.nickname || '내 프로필'}</h3>
                    <p className="text-xs text-gray-500 mt-1">프로필 정보를 관리하세요</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 친구 관리 - 1x1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={() => router.push('/dashboard/friends')}
              className="cursor-pointer group"
            >
              <div className="relative h-full rounded-2xl border border-gray-800/50 bg-black/40 backdrop-blur-sm p-6 transition-all duration-300 group-hover:border-gray-700/60 group-hover:bg-black/60 group-hover:scale-[1.02]">
                <div className="flex flex-col justify-between h-full">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20">
                      <Users2 className="h-5 w-5 text-green-400" />
                    </div>
                    {friendRequestCount > 0 && (
                      <span className="px-2 py-0.5 text-xs font-medium text-violet-300 bg-violet-500/20 border border-violet-500/30 rounded-full">
                        +{friendRequestCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-gray-100">친구 관리</h3>
                    <p className="text-xs text-gray-500 mt-1">{profile.friends || 0}명의 친구</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 시즌 - 1x1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              onClick={() => router.push('/dashboard/season')}
              className="cursor-pointer group"
            >
              <div className="h-full rounded-2xl border border-gray-800/50 bg-black/40 backdrop-blur-sm p-6 transition-all duration-300 group-hover:border-gray-700/60 group-hover:bg-black/60 group-hover:scale-[1.02]">
                <div className="flex flex-col justify-between h-full">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <Swords className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-gray-100">시즌</h3>
                    <p className="text-xs text-gray-500 mt-1">시즌 경쟁에 참여하세요</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 상점 - 1x1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onClick={() => router.push('/dashboard/shop')}
              className="cursor-pointer group"
            >
              <div className="h-full rounded-2xl border border-gray-800/50 bg-black/40 backdrop-blur-sm p-6 transition-all duration-300 group-hover:border-gray-700/60 group-hover:bg-black/60 group-hover:scale-[1.02]">
                <div className="flex flex-col justify-between h-full">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Store className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-gray-100">상점</h3>
                    <p className="text-xs text-gray-500 mt-1">코스메틱과 아이템을 구매하세요</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 업적 - 1x1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              onClick={() => router.push('/dashboard/achievements')}
              className="cursor-pointer group"
            >
              <div className="h-full rounded-2xl border border-gray-800/50 bg-black/40 backdrop-blur-sm p-6 transition-all duration-300 group-hover:border-gray-700/60 group-hover:bg-black/60 group-hover:scale-[1.02]">
                <div className="flex flex-col justify-between h-full">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <Award className="h-5 w-5 text-violet-400" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-gray-100">업적</h3>
                    <p className="text-xs text-gray-500 mt-1">도전 과제를 달성하세요</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 메시지 - 1x1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onClick={() => router.push('/dashboard/chat')}
              className="cursor-pointer group"
            >
              <div className="h-full rounded-2xl border border-gray-800/50 bg-black/40 backdrop-blur-sm p-6 transition-all duration-300 group-hover:border-gray-700/60 group-hover:bg-black/60 group-hover:scale-[1.02]">
                <div className="flex flex-col justify-between h-full">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/20">
                    <MessageSquare className="h-5 w-5 text-pink-400" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-gray-100">메시지</h3>
                    <p className="text-xs text-gray-500 mt-1">친구들과 대화를 나누세요</p>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>
    </div>
  )
}
