import { createClient } from '@/lib/supabase/server'
import { PortfolioClient } from './portfolio-client'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  
  // user 객체 보강: username 필드 추가
  const enrichedUser = {
    ...user,
    username: user.user_metadata?.username || user.email || '',
  }

  // 모든 쿼리를 병렬로 실행하여 성능 최적화
  const [holdingsResult, transactionsResult, profileResult] = await Promise.all([
    // 보유 주식 데이터 조회 (회사 조인 결과는 배열로 반환될 수 있음)
    supabase
      .from('holdings')
      .select(`
        id,
        shares,
        average_cost,
        company:companies(
          id,
          name,
          ticker,
          current_price,
          last_closing_price
        )
      `)
      .eq('user_id', enrichedUser.id),
    // 거래 내역 데이터 조회 (회사 조인 결과는 배열로 반환될 수 있음)
    supabase
      .from('transactions')
      .select(`
        id,
        shares,
        price,
        transaction_type,
        created_at,
        total_amount,
        company:companies(
          id,
          name,
          ticker,
          current_price,
          last_closing_price
        )
      `)
      .eq('user_id', enrichedUser.id)
      .order('created_at', { ascending: false })
      .limit(20),
    // 프로필 포인트 조회
    supabase
      .from('profiles')
      .select('points')
      .eq('id', enrichedUser.id)
      .single(),
  ])

  // holdings 결과 변환: shares를 quantity로 매핑하고, company 필드는 배열인 경우 첫 번째 객체를 사용
  const portfolio = (holdingsResult.data || []).map(item => ({
    ...item,
    quantity: item.shares,
    company: Array.isArray(item.company) ? item.company[0] : item.company,
  }))

  // transactions 결과 변환: company 필드가 배열이라면 첫 번째 값만 사용
  const transactions = (transactionsResult.data || []).map(item => ({
    ...item,
    company: Array.isArray(item.company) ? item.company[0] : item.company,
  }))

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PortfolioClient
        user={enrichedUser}
        portfolio={portfolio}
        transactions={transactions}
        points={profileResult.data?.points || 0}
      />
    </Suspense>
  )
}
