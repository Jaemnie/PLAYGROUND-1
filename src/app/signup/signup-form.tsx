"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader } from '@/components/ui/card'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function SignUpForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [isPasswordValid, setIsPasswordValid] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    try {
      const formData = new FormData(e.currentTarget)
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error)
        return
      }

      setIsSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (error) {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    setIsPasswordValid(value.length >= 6)
  }

  return (
    <>
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
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-500 text-center mt-2"
              >
                {error}
              </motion.p>
            )}
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
                minLength={6}
                value={password}
                onChange={handlePasswordChange}
                className={`bg-black/30 border-gray-800 focus:border-gray-700 focus:ring-gray-700 text-gray-100 placeholder:text-gray-500 ${
                  password && !isPasswordValid ? 'border-red-500/50' : ''
                }`}
                placeholder="••••••••"
              />
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      !password ? 'bg-gray-700' : isPasswordValid ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  >
                    {password && (
                      <motion.svg
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        {isPasswordValid ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </motion.svg>
                    )}
                  </div>
                  <span className={`${
                    !password ? 'text-gray-500' : isPasswordValid ? 'text-green-500' : 'text-red-500'
                  }`}>
                    최소 6자 이상 입력해주세요
                  </span>
                </div>
              </div>
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
          className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 border border-gray-800/50 shadow-xl text-center max-w-sm mx-4"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ 
                duration: 0.6,
                ease: "easeInOut",
                times: [0, 0.3, 0.6, 1]
              }}
              className="text-6xl mb-6"
            >
              ✨
            </motion.div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent mb-4">
              회원가입 완료!
            </h3>
            <div className="space-y-4 text-gray-400">
              <p>
                이메일로 인증 링크가 발송되었습니다.<br />
                <span className="text-blue-400">3분</span> 이내에 이메일을 확인하여<br />
                인증을 완료해주세요.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-sm text-blue-400">
                  인증 링크는 <span className="font-semibold">3분</span> 동안만 유효합니다.<br />
                  시간 내에 인증하지 못한 경우 회원가입을<br />다시 진행해주세요.
                </p>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-gray-500 mt-6"
            >
              잠시 후 로그인 페이지로 이동합니다...
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </>
  )
} 