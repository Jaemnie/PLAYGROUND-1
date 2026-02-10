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

    // 현재 활성 시즌 (테마별 기업/뉴스 필터링용 + UI 표시용)
    const { data: activeSeason } = await supabase
      .from('seasons')
      .select('season_number, ends_at, theme_id, theme:season_themes(name, theme_code)')
      .eq('status', 'active')
      .single()

    const themeId = activeSeason?.theme_id ?? null

    // 테마 기업 ID 목록 (뉴스 필터용)
    const themeCompanyIds = themeId
      ? (await supabase.from('companies').select('id').eq('theme_id', themeId)).data?.map((c) => c.id) ?? []
      : []

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
      
      // 주요 기업 목록 (현재 시즌 테마 기업만, 시가총액 순)
      themeId
        ? supabase
            .from('companies')
            .select('*')
            .eq('theme_id', themeId)
            .order('market_cap', { ascending: false })
        : supabase
            .from('companies')
            .select('*')
            .order('market_cap', { ascending: false }),
      
      // 최신 뉴스 (현재 시즌 테마 기업 뉴스만)
      themeCompanyIds.length > 0
        ? supabase
            .from('news')
            .select('*')
            .in('company_id', themeCompanyIds)
            .order('published_at', { ascending: false })
        : supabase
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
          themeCompanyIds={themeCompanyIds}
          activeSeason={activeSeason ? { season_number: activeSeason.season_number, ends_at: activeSeason.ends_at, theme: activeSeason.theme } : null}
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
