'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function DashboardBackButton() {
  const router = useRouter()

  function handleReturnToDashboard() {
    router.push('/dashboard')
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Button
        type="button"
        className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70 flex items-center gap-2"
        onClick={handleReturnToDashboard}
      >
        <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
        <span className="text-zinc-200">대시보드</span>
      </Button>
    </motion.div>
  )
}