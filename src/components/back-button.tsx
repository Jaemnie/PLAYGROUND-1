'use client'

import { Button, type ButtonProps } from '@/components/ui/button'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

export function BackButton() {
  const router = useRouter()
  const pathname = usePathname()

  // 현재 경로에서 마지막 세그먼트를 제거해 부모 경로를 구함.
  const getParentPath = (path: string) => {
    if (!path || path === '/') return '/'
    const segments = path.split('/').filter(Boolean)
    if (segments.length === 0) return '/'
    segments.pop() // 마지막 세그먼트를 제거합니다.
    return '/' + segments.join('/')
  }

  const handleBack = () => {
    const parentPath = getParentPath(pathname)
    router.push(parentPath)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Button
        type="button"
        className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70"
        onClick={handleBack}
      >
        <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
        <span className="sr-only">뒤로 가기</span>
      </Button>
    </motion.div>
  )
}
