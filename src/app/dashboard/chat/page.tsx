import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatInterface } from './components/chat-interface'
import DashboardBackButton from '@/components/DashboardBackButton'

export default async function ChatPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  
  // 사용자 프로필 정보 가져오기
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .single()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>
      <div className="container mx-auto px-4 py-20">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">메시지</h1>
        <ChatInterface 
          userId={user.id} 
          userNickname={profile?.nickname || user.email || '사용자'} 
        />
      </div>
    </div>
  )
} 