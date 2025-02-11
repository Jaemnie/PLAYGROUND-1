"use client"

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader } from '@/components/ui/card'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function SignUpForm() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const error = searchParams.get('error')
  const [isSuccess, setIsSuccess] = useState(false)

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
          <CardHeader className="space-y-1">
            <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              회원가입
            </h2>
            <p className="text-sm text-gray-400 text-center">
              새로운 계정을 만들어보세요
            </p>
          </CardHeader>
          <form action="/api/auth/signup" method="post" className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-gray-300">
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
              <label htmlFor="password" className="text-sm text-gray-300">
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
              <label htmlFor="nickname" className="text-sm text-gray-300">
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
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? '처리중...' : '회원가입'}
            </Button>
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