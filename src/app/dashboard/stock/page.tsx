import { createClient } from '@/lib/supabase/server'
import { StockDashboardClient } from './stock-dashboard-client'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function StockDashboardPage() {
  const supabase = await createClient()
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }

    // 필요한 초기 데이터 병렬로 가져오기
    const [
      portfolioResult,
      companiesResult,
      newsResult,
      profileResult
    ] = await Promise.all([
      // 사용자의 포트폴리오 정보
      supabase
        .from('holdings')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('user_id', user.id),
      
      // 주요 기업 목록 (시가총액 순)
      supabase
        .from('companies')
        .select('*')
        .order('market_cap', { ascending: false }),
      
      // 최신 뉴스
      supabase
        .from('news')
        .select('*')
        .order('published_at', { ascending: false }),
      
      // 사용자 프로필 정보
      supabase
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single()
    ])

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <StockDashboardClient 
          user={user}
          initialPortfolio={portfolioResult.data || []}
          initialCompanies={companiesResult.data || []}
          initialNews={newsResult.data || []}
          points={profileResult.data?.points || 0}
        />
      </Suspense>
    )
  } catch (error) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
}
