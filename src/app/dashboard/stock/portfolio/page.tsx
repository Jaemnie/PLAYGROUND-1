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

  // 사용자의 보유 주식 정보 (회사 정보 포함)
  const holdingsResult = await supabase
    .from('holdings')
    .select(`
      id,
      shares,
      average_cost,
      company:companies(
        id,
        name,
        ticker,
        current_price
      )
    `)
    .eq('user_id', user.id)

  // 사용자 거래 내역 조회 (최신순)
  const transactionsResult = await supabase
    .from('transactions')
    .select(`
      id,
      shares,
      price,
      transaction_type,
      created_at,
      company:companies(
        id,
        name,
        ticker
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20) // 최근 20개 거래만 로드

  // 사용자 포인트 정보 조회
  const profileResult = await supabase
    .from('profiles')
    .select('points')
    .eq('id', user.id)
    .single()

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PortfolioClient
        user={user}
        portfolio={holdingsResult.data || []}
        transactions={transactionsResult.data || []}
        points={profileResult.data?.points || 0}
      />
    </Suspense>
  )
}
