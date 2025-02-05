'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'

export function BackButton() {
  const router = useRouter()
  const pathname = usePathname()
  const [previousPath, setPreviousPath] = useState<string>('')
  const isNavigatingBack = useRef(false)
  
  useEffect(() => {
    // 뒤로가기로 인한 경로 변경이면 히스토리를 업데이트하지 않음
    if (isNavigatingBack.current) {
      isNavigatingBack.current = false
      return
    }

    const currentPath = window.location.pathname
    const storedPaths = JSON.parse(localStorage.getItem('pathHistory') || '[]')
    
    // 현재 경로가 마지막 저장된 경로와 다른 경우에만 저장
    if (storedPaths[storedPaths.length - 1] !== currentPath) {
      const newPaths = [...storedPaths, currentPath].slice(-10)
      localStorage.setItem('pathHistory', JSON.stringify(newPaths))
    }

    // 이전 경로 설정
    const prevPath = storedPaths[storedPaths.length - 2] || '/'
    setPreviousPath(prevPath)
  }, [pathname])

  const handleBack = () => {
    if (previousPath) {
      isNavigatingBack.current = true
      
      // 현재 저장된 경로 목록을 가져옴
      const storedPaths = JSON.parse(localStorage.getItem('pathHistory') || '[]')
      
      // 현재 경로만 제거
      const newPaths = storedPaths.slice(0, -1)
      localStorage.setItem('pathHistory', JSON.stringify(newPaths))
      
      router.push(previousPath)
    } else {
      router.push('/')
    }
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBack}
        className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70"
      >
        <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
        <span className="sr-only">뒤로 가기</span>
      </Button>
    </motion.div>
  )
}
