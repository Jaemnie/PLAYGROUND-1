import { createClient } from '@/lib/supabase/server'
import { MainPageWrapper } from '@/components/main-page-wrapper'
import { redirect } from 'next/navigation'

export default async function MainPage() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }

    const [sectionsResult, adminResult] = await Promise.all([
      supabase.from('guide_sections').select('*').order('created_at', { ascending: true }),
      supabase.from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
    ])

    return <MainPageWrapper 
      initialSections={sectionsResult.data || []} 
      initialIsAdmin={!!adminResult?.data} 
    />

  } catch (error) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
}