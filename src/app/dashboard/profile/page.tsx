import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from './components/ProfileClient'
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

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ProfileClient 
          user={user}
          profile={profile}
        />
      </Suspense>
    )
  } catch (error) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
} 