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
    
    // 프로필 정보 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    // 관리자 권한 확인
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    const isAdmin = !!adminUser
    
    // 친구 요청 수 조회
    const { count: friendRequestCount } = await supabase
      .from('friends')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', user.id)
      .eq('status', 'pending')
    
    // 주식 보유 현황 조회
    const { data: holdings } = await supabase
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
      .eq('user_id', user.id)
    
    // 최근 뉴스 조회
    const { data: news } = await supabase
      .from('news')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(5)
    
    // 최근 채팅 메시지 조회
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    // Bustabit 게임 통계 조회
    const { data: bustabitStats } = await supabase
      .from('bustabit_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardClient 
          user={user}
          profile={profile}
          isAdmin={isAdmin}
          friendRequestCount={friendRequestCount || 0}
          holdings={holdings || []}
          news={news || []}
          messages={messages || []}
          bustabitStats={bustabitStats || null}
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