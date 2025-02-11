"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientBrowser } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import Link from 'next/link'
import { motion } from 'framer-motion'

export function SignUpForm() {
  const router = useRouter()
  const supabase = createClientBrowser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })

      if (signUpError) throw signUpError

      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ nickname })
          .eq('id', user.id)

        if (profileError) throw profileError
      }

      setIsSuccess(true)
      setTimeout(() => {
        router.push('/login?message=회원가입이 완료되었습니다. 이메일을 확인해주세요.')
      }, 1500)
    } catch (error) {
      setError('회원가입에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: isSuccess ? 0 : 1, 
          y: isSuccess ? -20 : 0,
          scale: isSuccess ? 0.95 : 1 
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
          <form onSubmit={handleSignUp}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm text-gray-300">이메일</label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-black/30 border-gray-800 focus:border-gray-700 focus:ring-gray-700 text-gray-100 placeholder:text-gray-500"
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm text-gray-300">비밀번호</label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-black/30 border-gray-800 focus:border-gray-700 focus:ring-gray-700 text-gray-100 placeholder:text-gray-500"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="nickname" className="text-sm text-gray-300">닉네임</label>
                <Input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  className="bg-black/30 border-gray-800 focus:border-gray-700 focus:ring-gray-700 text-gray-100 placeholder:text-gray-500"
                  placeholder="닉네임을 입력해주세요"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? '처리중...' : '회원가입'}
              </Button>
              <p className="text-sm text-gray-400 text-center">
                이미 계정이 있으신가요?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                  로그인
                </Link>
              </p>
            </CardFooter>
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