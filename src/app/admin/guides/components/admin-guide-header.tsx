'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlusIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import DashboardBackButton from '@/components/DashboardBackButton'

export function AdminGuideHeader() {
  const router = useRouter()

  return (
    <>
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>
      <div className="space-y-8 w-full max-w-3xl mx-auto">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400"
        >
          가이드 관리
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-gray-300 text-lg max-w-2xl mx-auto"
        >
          가이드 섹션을 관리하고 새로운 콘텐츠를 추가하세요
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button 
            onClick={() => router.push('/admin/guides/sections/new')}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white shadow-lg hover:shadow-xl transition-all"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            새 섹션 만들기
          </Button>
        </motion.div>
      </div>
    </>
  )
} 