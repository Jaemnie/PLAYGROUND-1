'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientBrowser } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClientBrowser()
        const { error } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        router.replace('/login?message=인증이 완료되었습니다.')
      } catch (error) {
        console.error('인증 오류:', error)
        router.replace('/login?error=인증에 실패했습니다. 다시 시도해주세요.')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-100 mb-4">이메일 인증 처리 중...</h1>
        <p className="text-gray-400">잠시만 기다려주세요.</p>
      </div>
    </div>
  )
} 