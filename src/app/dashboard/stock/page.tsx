import { createClient } from '@/lib/supabase/server'
import { StockDashboardClient } from './stock-dashboard-client'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function StockDashboardPage() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }

    // user 객체에 name 프로퍼티 추가 (예시: user_metadata.full_name 또는 email 사용)
    const enrichedUser = {
      ...user,
      name: user.user_metadata?.full_name || user.email || ''
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
          user={enrichedUser}
          initialPortfolio={portfolioResult.data || []}
          initialCompanies={companiesResult.data || []}
          initialNews={newsResult.data || []}
          points={profileResult.data?.points || 0}
        />
      </Suspense>
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl font-bold text-gray-300 mb-4">오류 발생</p>
          <p className="text-gray-500 mb-6">데이터를 불러오는 중 문제가 발생했습니다.</p>
          <a
            href="/dashboard/stock"
            className="inline-block px-6 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
          >
            다시 시도
          </a>
        </div>
      </div>
    )
  }
}
