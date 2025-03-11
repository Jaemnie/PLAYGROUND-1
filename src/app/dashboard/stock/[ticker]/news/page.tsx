import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { NewsListClient } from './news-list-client'

export default async function CompanyNewsPage({ 
  params 
}: { 
  params: Promise<{ ticker: string }> 
}) {
  const { ticker } = await params

  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }

    // 기업 정보 먼저 조회
    const companyResult = await supabase
      .from('companies')
      .select('*')
      .eq('ticker', ticker)
      .single()

    if (!companyResult.data) {
      notFound()
    }

    // 기업 뉴스 정보 (전체 가져오기)
    const companyNewsResult = await supabase
      .from('news')
      .select('*')
      .eq('company_id', companyResult.data?.id)
      .order('published_at', { ascending: false })
      .limit(100) // 최대 100개 뉴스 가져오기

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <NewsListClient 
          company={companyResult.data}
          companyNews={companyNewsResult.data || []}
        />
      </Suspense>
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
} 