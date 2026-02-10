import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { AllNewsClient } from './all-news-client'

export default async function AllNewsPage() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }

    // 현재 시즌 테마 기업만 뉴스 표시
    const { data: activeSeason } = await supabase
      .from('seasons')
      .select('theme_id')
      .eq('status', 'active')
      .single()

    const themeId = activeSeason?.theme_id ?? null
    const themeCompanyIds = themeId
      ? (await supabase.from('companies').select('id').eq('theme_id', themeId)).data?.map((c) => c.id) ?? []
      : []

    // 뉴스 정보 가져오기 (현재 시즌 테마 기업 뉴스만, 최신순)
    const allNewsResult = themeCompanyIds.length > 0
      ? await supabase
          .from('news')
          .select(`
            *,
            companies:company_id (
              id,
              name,
              ticker
            )
          `)
          .in('company_id', themeCompanyIds)
          .order('published_at', { ascending: false })
          .limit(100)
      : await supabase
          .from('news')
          .select(`
            *,
            companies:company_id (
              id,
              name,
              ticker
            )
          `)
          .order('published_at', { ascending: false })
          .limit(100)

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <AllNewsClient 
          allNews={allNewsResult.data || []}
        />
      </Suspense>
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
} 