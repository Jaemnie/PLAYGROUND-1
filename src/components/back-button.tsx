'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

interface BackButtonProps {
  // 부모 컴포넌트에서 직접 원하는 이동 URL을 전달할 수 있습니다.
  backUrl?: string
}

export function BackButton({ backUrl }: BackButtonProps) {
  const router = useRouter()
  const currentPath = usePathname()

  function handleBack() {
    if (backUrl) {
      router.push(backUrl)
    } else if (!currentPath || currentPath === '/') {
      router.push('/')
    } else {
      // 현재 경로의 마지막 세그먼트를 제거하여 부모 경로로 이동
      const segments = currentPath.split('/').filter(Boolean)
      segments.pop() // 마지막 세그먼트를 제거합니다.
      router.push('/' + segments.join('/'))
    }
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
