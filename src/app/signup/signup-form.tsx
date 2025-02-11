"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader } from '@/components/ui/card'
import { AlertDialog } from '@/components/ui/alert-dialog'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function SignUpForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [alertState, setAlertState] = useState({
    isOpen: false,
    message: '',
    isError: false
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setAlertState({
          isOpen: true,
          message: data.error,
          isError: true
        })
      } else {
        setAlertState({
          isOpen: true,
          message: data.message,
          isError: false
        })
        // 성공 메시지를 보여준 후 로그인 페이지로 이동
        setTimeout(() => {
          router.push('/login')
        }, 2000)
        setIsSuccess(true)
      }
    } catch (error) {
      setAlertState({
        isOpen: true,
        message: '오류가 발생했습니다. 다시 시도해주세요.',
        isError: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <AlertDialog
        isOpen={alertState.isOpen}
        message={alertState.message}
        onClose={() => {
          setAlertState(prev => ({ ...prev, isOpen: false }))
          if (!alertState.isError) setIsSuccess(true)
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: isSuccess ? 0 : 1,
          y: isSuccess ? -20 : 0,
          scale: isSuccess ? 0.95 : 1,
        }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-[400px] bg-black/40 backdrop-blur-sm border border-gray-800/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              회원가입
            </h2>
            <p className="text-sm text-gray-400 text-center">
              새로운 계정을 만들어보세요
            </p>
          </CardHeader>
          <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-300">
                이메일
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                className="bg-black/30 border-gray-800 focus:border-gray-700 focus:ring-gray-700 text-gray-100 placeholder:text-gray-500"
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                비밀번호
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="bg-black/30 border-gray-800 focus:border-gray-700 focus:ring-gray-700 text-gray-100 placeholder:text-gray-500"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="nickname" className="text-sm font-medium text-gray-300">
                닉네임
              </label>
              <Input
                id="nickname"
                name="nickname"
                type="text"
                required
                className="bg-black/30 border-gray-800 focus:border-gray-700 focus:ring-gray-700 text-gray-100 placeholder:text-gray-500"
                placeholder="닉네임을 입력해주세요"
              />
            </div>
            <div className="pt-2">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? '처리중...' : '회원가입'}
              </Button>
              <p className="text-sm text-gray-400 text-center mt-4">
                이미 계정이 있으신가요?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300">
                  로그인
                </Link>
              </p>
            </div>
          </form>
        </Card>
      </motion.div>
      {isSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute text-center text-white"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-6xl mb-4"
          >
            ✨
          </motion.div>
          <h3 className="text-2xl font-bold text-gradient bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            회원가입 완료!
          </h3>
        </motion.div>
      )}
    </>
  )
} 