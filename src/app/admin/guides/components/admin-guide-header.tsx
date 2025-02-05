'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlusIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import { BackButton } from '@/components/back-button'

export function AdminGuideHeader() {
  const router = useRouter()

  return (
    <>
      <div className="fixed top-4 left-4 z-50">
        <BackButton />
      </div>
      <div className="space-y-8">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400"
        >
          가이드 관리
        </motion.h1>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button 
            onClick={() => router.push('/admin/guides/sections/new')}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            새 섹션 만들기
          </Button>
        </motion.div>
      </div>
    </>
  )
} 