"use client"

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'

export function LoginForm() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message')
  const error = searchParams.get('error')

  return (
    <Card className="w-[400px] bg-black/40 backdrop-blur-sm border border-gray-800/50 shadow-xl">
      <CardHeader className="space-y-1">
        <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          로그인
        </h2>
        <p className="text-sm text-gray-400 text-center">
          계정에 로그인하세요
        </p>
      </CardHeader>
      <form action="/api/auth/login" method="post">
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
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-green-400 text-sm">{message}</p>}
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
  )
} 