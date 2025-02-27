import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FriendsList } from './components/friends-list'
import DashboardBackButton from '@/components/DashboardBackButton'

export default async function FriendsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>
      <div className="container mx-auto px-4 py-20">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">친구 관리</h1>
        <FriendsList userId={user.id} />
      </div>
    </div>
  )
} 