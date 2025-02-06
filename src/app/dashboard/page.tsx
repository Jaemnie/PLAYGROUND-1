import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

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