import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // 친구 수 업데이트
  await updateFriendCount(supabase, user.id)

  const [profileResult, adminResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
  ])

  return (
    <DashboardClient 
      user={user} 
      profile={profileResult.data || {}} 
      isAdmin={!!adminResult.data}
    />
  )
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