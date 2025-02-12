'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  BarChart3,
  Trophy,
  Users2,
  ShoppingBag,
  LogOut,
  Settings,
  ArrowLeft,
  UserCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { logout } from '@/lib/actions/auth'
import { User } from '@supabase/supabase-js'
import { LogoutButton } from '@/components/logout-button'

interface DashboardClientProps {
  user: User
  profile: {
    nickname: string
    points: number
    friends: number
  }
  isAdmin: boolean  // admin_users 테이블 체크 결과
}

export function DashboardClient({ user, profile, isAdmin }: DashboardClientProps) {
  const router = useRouter()

  const stats = [
    {
      title: '주식 시뮬레이션',
      value: '시작하기',
      icon: <BarChart3 className="h-6 w-6" />,
      description: '가상 주식 거래를 체험해보세요',
      href: '/dashboard/stock'
    },
    {
      title: '내 프로필',
      value: profile.nickname || '프로필',
      icon: <UserCircle className="h-6 w-6" />,
      description: '프로필 정보를 관리하세요',
      href: '/dashboard/profile'
    },
    ...(isAdmin ? [
      {
        title: '스케줄러 모니터링',
        value: '관리자 전용',
        icon: <Settings className="h-6 w-6" />,
        description: '마켓 스케줄러 상태를 확인하세요',
        href: '/admin/guides'
      }
    ] : [])
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            type="button"
            onClick={() => router.push('/main')}
            variant="ghost"
            className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70 flex items-center gap-2"
          >
            <ArrowLeft className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
            <span className="text-zinc-200">메인으로</span>
          </Button>
        </motion.div>
      </div>
      <div className="fixed top-4 right-4 z-50">
        <LogoutButton />
      </div>
      
      {/* 헤더 섹션 */}
      <section className="relative pt-32 pb-20 px-4 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl"
          >
            <h1 className="text-3xl font-bold text-gray-100">
              안녕하세요, {profile.nickname || '사용자'} 님 👋
            </h1>
            <p className="mt-2 text-gray-400">
              오늘도 새로운 지식을 탐험해보세요.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 통계 카드 섹션 */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => router.push(stat.href)}
                className="cursor-pointer"
              >
                <Card className="bg-black/40 backdrop-blur-sm border border-gray-800/50 hover:bg-black/60 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <h3 className="text-sm font-medium text-gray-400">
                      {stat.title}
                    </h3>
                    <div className="text-violet-400">
                      {stat.icon}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-100">
                      {stat.value}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
} 