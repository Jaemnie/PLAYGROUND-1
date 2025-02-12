import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from './profile-client'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function ProfilePage() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }

    // 프로필 정보 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // 거래 통계 조회
    const { data: tradingStats } = await supabase
      .from('profiles')
      .select('trading_volume, gain_percentage')
      .eq('id', user.id)
      .single()

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ProfileClient 
          user={user}
          profile={profile}
          tradingStats={tradingStats}
        />
      </Suspense>
    )
  } catch (error) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
} 