"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isShaking, setIsShaking] = useState(false)

  // 로그인 폼 마운트 시 쿠키에서 flash 메시지 읽기
  useEffect(() => {
    const getFlashMessage = () => {
      const cookies = document.cookie.split('; ').reduce((acc: Record<string, string>, cookie) => {
        const [key, value] = cookie.split('=')
        acc[key] = value
        return acc
      }, {})

      if (cookies.flash) {
        setError(decodeURIComponent(cookies.flash))
        // 읽은 후 flash 쿠키 삭제
        document.cookie = 'flash=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
      }
    }
    getFlashMessage()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const formData = new FormData()
      formData.append('email', email)
      formData.append('password', password)

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        setIsShaking(true)
        setTimeout(() => {
          setIsShaking(false)
        }, 500)
      } else {
        router.push(data.redirect)
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
      setIsShaking(true)
      setTimeout(() => {
        setIsShaking(false)
      }, 500)
    }
  }

  return (
    <motion.div
      animate={isShaking ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-[400px] bg-black/40 backdrop-blur-sm border border-gray-800/50 shadow-xl">
        <CardHeader className="space-y-1">
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            로그인
          </h2>
          <p className="text-sm text-gray-400 text-center">
            계정에 로그인하세요
          </p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-gray-300">
                이메일
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/30 border-gray-800 focus:border-gray-700 focus:ring-gray-700 text-gray-100 placeholder:text-gray-500"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p
                className={`text-sm ${
                  error === '인증이 완료되었습니다'
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white transition-all duration-300"
            >
              로그인
            </Button>
            <p className="text-sm text-gray-400 text-center">
              계정이 없으신가요?{' '}
              <Link
                href="/signup"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                회원가입
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  )
} 