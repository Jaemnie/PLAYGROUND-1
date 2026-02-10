import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }
    
    // 프로필 및 친구 요청 수만 조회
    const [
      profileResult,
      friendResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', user.id)
        .eq('status', 'pending'),
    ])

    const profile = profileResult.data
    const friendRequestCount = friendResult.count
    
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardClient 
          user={user}
          profile={profile}
          friendRequestCount={friendRequestCount || 0}
        />
      </Suspense>
    )
  } catch (error) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
}

// 친구 수 업데이트 함수
async function updateFriendCount(supabase: any, userId: string) {
  try {
    // 친구 수 조회
    const { data, error } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'accepted')
    
    if (error) {
      console.error('친구 수 조회 오류:', error)
      return
    }
    
    // 프로필 테이블 업데이트
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ friends: data.length })
      .eq('id', userId)
    
    if (updateError) {
      console.error('프로필 업데이트 오류:', updateError)
    }
  } catch (error) {
    console.error('친구 수 업데이트 오류:', error)
  }
} 