import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return <DashboardClient user={user} profile={profile || {}} />
  } catch (error) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
} 