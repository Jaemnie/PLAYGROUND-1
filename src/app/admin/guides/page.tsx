import { createClient } from '@/lib/supabase/server'
import { AdminGuideContainer } from './components/admin-guide-container'
import { redirect } from 'next/navigation'

export default async function AdminGuidePage() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/login')
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('guide_sections')
    .select('*')
    .order('created_at', { ascending: true })

  if (sectionsError) {
    console.error('섹션 데이터 로딩 오류:', sectionsError)
    return <div>데이터를 불러오는 중 오류가 발생했습니다.</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="relative">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative container mx-auto px-4 py-10">
          <AdminGuideContainer initialSections={sections || []} />
        </div>
      </div>
    </div>
  )
}