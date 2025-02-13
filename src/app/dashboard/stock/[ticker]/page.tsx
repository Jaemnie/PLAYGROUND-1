import { createClient } from '@/lib/supabase/server'
import { StockDetailClient } from './stock-detail-client'
import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function StockDetailPage({ 
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

    // user 객체에 name 프로퍼티 추가
    const enrichedUser = {
      ...user,
      name: user.user_metadata?.full_name || user.email || ''
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

    // 나머지 데이터 병렬로 가져오기
    const [holdingResult, profileResult, companyNewsResult] = await Promise.all([
      // 사용자의 보유 주식 정보
      supabase
        .from('holdings')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', companyResult.data?.id)
        .maybeSingle(),
      
      // 사용자 포인트 정보
      supabase
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single(),
      
      // 기업 뉴스 정보
      supabase
        .from('news')
        .select('*')
        .eq('company_id', companyResult.data?.id)
        .order('published_at', { ascending: false })
        .limit(5)
    ])

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <StockDetailClient 
          user={enrichedUser}
          company={companyResult.data}
          holding={holdingResult.data || null}
          points={profileResult.data?.points || 0}
          companyNews={companyNewsResult.data || []}
        />
      </Suspense>
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    return <div>오류가 발생했습니다.</div>
  }
} 