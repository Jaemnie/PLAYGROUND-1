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
  UserCircle,
  MessageSquare
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="relative">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative container mx-auto px-4 py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 프로필 카드 */}
            <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h3 className="text-sm font-medium text-gray-400">
                  안녕하세요, {profile.nickname || '사용자'} 님 👋
                </h3>
                <div className="text-violet-400">
                  <UserCircle className="h-6 w-6" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-100">
                  {profile.nickname || '사용자'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  오늘도 새로운 지식을 탐험해보세요.
                </p>
              </CardContent>
            </Card>
            
            {/* 메뉴 카드 */}
            <Card className="bg-black/40 backdrop-blur-sm border-gray-800 md:col-span-2">
              <CardHeader>
                <h2 className="text-2xl font-bold text-gray-100">메뉴</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* 기존 메뉴 항목들 */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 p-6 rounded-xl border border-white/10 cursor-pointer"
                    onClick={() => router.push('/dashboard/stock')}
                  >
                    <ShoppingBag className="h-8 w-8 text-blue-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-100">주식 거래</h3>
                    <p className="text-sm text-gray-400 mt-1">가상 주식 거래 시뮬레이션</p>
                  </motion.div>
                  
                  {/* 친구 목록 메뉴 추가 */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-gradient-to-br from-green-500/20 to-teal-600/20 p-6 rounded-xl border border-white/10 cursor-pointer"
                    onClick={() => router.push('/dashboard/friends')}
                  >
                    <Users2 className="h-8 w-8 text-green-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-100">친구</h3>
                    <p className="text-sm text-gray-400 mt-1">친구 관리 및 추가</p>
                  </motion.div>
                  
                  {/* 채팅 메뉴 추가 */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-gradient-to-br from-yellow-500/20 to-orange-600/20 p-6 rounded-xl border border-white/10 cursor-pointer"
                    onClick={() => router.push('/dashboard/chat')}
                  >
                    <MessageSquare className="h-8 w-8 text-yellow-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-100">메시지</h3>
                    <p className="text-sm text-gray-400 mt-1">친구와 채팅하기</p>
                  </motion.div>
                  
                  {/* 기존 메뉴 항목들 */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-gradient-to-br from-purple-500/20 to-pink-600/20 p-6 rounded-xl border border-white/10 cursor-pointer"
                    onClick={() => router.push('/dashboard/profile')}
                  >
                    <UserCircle className="h-8 w-8 text-purple-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-100">프로필</h3>
                    <p className="text-sm text-gray-400 mt-1">내 정보 관리</p>
                  </motion.div>
                  
                  {/* ... 기존 메뉴 항목들 ... */}
                </div>
              </CardContent>
            </Card>
            
            {/* ... 기존 코드 유지 ... */}
          </div>
        </div>
      </div>
    </div>
  )
} 