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
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>

      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">
            STACKS
          </p>
          <h1 className="text-2xl font-bold text-gray-100">
            친구 관리
          </h1>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          <FriendsList userId={user.id} />
        </div>
      </section>
    </div>
  )
} 