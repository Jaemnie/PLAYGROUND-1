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
    
    // 모든 쿼리를 병렬로 실행하여 성능 최적화
    const [
      profileResult,
      friendResult,
      holdingsResult,
      newsResult,
      messagesResult,
    ] = await Promise.all([
      // 프로필 정보 조회
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      // 친구 요청 수 조회
      supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', user.id)
        .eq('status', 'pending'),
      // 주식 보유 현황 조회
      supabase
        .from('holdings')
        .select(`
          id,
          shares,
          company:companies(
            id,
            name,
            ticker,
            current_price,
            last_closing_price
          )
        `)
        .eq('user_id', user.id),
      // 최근 뉴스 조회
      supabase
        .from('news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(5),
      // 최근 채팅 메시지 조회
      supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const profile = profileResult.data
    const friendRequestCount = friendResult.count
    const holdings = holdingsResult.data
    const news = newsResult.data
    const messages = messagesResult.data
    
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardClient 
          user={user}
          profile={profile}
          friendRequestCount={friendRequestCount || 0}
          holdings={holdings || []}
          news={news || []}
          messages={messages || []}
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