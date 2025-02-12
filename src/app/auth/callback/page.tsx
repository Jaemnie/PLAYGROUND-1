'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientBrowser } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClientBrowser()!
        const { error } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        // 인증 성공 시 쿠키를 이용해 메시지를 저장
        document.cookie = `flash=${encodeURIComponent('인증이 완료되었습니다.')}; path=/;`
        router.replace('/login')
      } catch (error) {
        console.error('인증 오류:', error)
        // 인증 실패 시 쿠키에 에러 메시지 저장
        document.cookie = `flash=${encodeURIComponent('인증에 실패했습니다. 다시 시도해주세요.')}; path=/;`
        router.replace('/login')
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