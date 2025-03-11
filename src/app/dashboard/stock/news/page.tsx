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

    // 모든 뉴스 정보 가져오기 (최신순)
    const allNewsResult = await supabase
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
      .limit(100) // 최대 100개 뉴스 가져오기

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