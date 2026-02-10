import { createClient } from '@/lib/supabase/server'
import { LeaderboardClient } from './leaderboard-client'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface Company {
  current_price: number
}

interface Holding {
  user_id: string
  shares: number
  company: Company | Company[] | null
}

interface Profile {
  id: string
  nickname: string | null
  points: number
}

// LeaderboardClient에서 사용하는 User 인터페이스와 일치하도록 정의
interface User {
  id: string
  nickname?: string
  points: number
  stock_value: number
  total_capital: number
  tier?: string
  division?: number
}

export default async function LeaderboardPage() {
  const supabase = await createClient()

  // 모든 사용자의 보유 주식 정보 가져오기
  const { data: holdings } = await supabase
    .from('holdings')
    .select(`
      user_id,
      shares,
      company:companies(current_price)
    `)
  
  
  // 사용자별 주식 자산 계산
  const userStockValues = new Map<string, number>()
  const userIds = new Set<string>()
  
  if (holdings) {
    holdings.forEach((holding: Holding) => {
      const userId = holding.user_id
      userIds.add(userId) // 사용자 ID 수집
      
      let companyPrice = 0
      
      if (holding.company) {
        if (Array.isArray(holding.company)) {
          companyPrice = holding.company[0]?.current_price || 0
        } else {
          companyPrice = holding.company.current_price || 0
        }
      }
      
      const stockValue = holding.shares * companyPrice
      
      if (userStockValues.has(userId)) {
        userStockValues.set(userId, userStockValues.get(userId)! + stockValue)
      } else {
        userStockValues.set(userId, stockValue)
      }
    })
  }
  
  
  // 모든 프로필 정보 가져오기 (ID 필터링 없이)
  const { data: allProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, nickname, points')
  
  
  // 수집된 사용자 ID를 기반으로 프로필 정보 필터링
  const userIdsArray = Array.from(userIds)
  let profiles: Profile[] = []
  
  if (allProfiles && allProfiles.length > 0) {
    // 클라이언트 측에서 필터링
    profiles = allProfiles.filter(profile => userIds.has(profile.id)) as Profile[]
  }
  
  
  // 프로필 정보가 없는 사용자 ID 찾기
  const missingProfileIds = userIdsArray.filter(id => 
    !profiles.some(profile => profile.id === id)
  )
  
  
  // 프로필 정보가 없는 사용자를 위한 기본 프로필 생성
  const defaultProfiles = missingProfileIds.map(id => ({
    id,
    nickname: `사용자 ${id.substring(0, 8)}`,
    points: 0
  }))
  
  // 기존 프로필과 기본 프로필 합치기
  profiles = [...profiles, ...defaultProfiles]
  
  // 랭크 정보 조회
  const { data: ranks } = await supabase
    .from('user_ranks')
    .select('user_id, tier, division')

  const rankMap = new Map<string, { tier: string; division: number }>()
  if (ranks) {
    for (const r of ranks) {
      rankMap.set(r.user_id, { tier: r.tier, division: r.division })
    }
  }

  // 사용자 데이터 가공: 포인트와 주식 자산을 합쳐 총 자본 계산
  const usersWithTotalCapital: User[] = profiles.map(user => {
    const stockValue = userStockValues.get(user.id) || 0
    const rank = rankMap.get(user.id)
    return {
      id: user.id,
      nickname: user.nickname || undefined,
      points: user.points || 0,
      stock_value: stockValue,
      total_capital: (user.points || 0) + stockValue,
      tier: rank?.tier || 'bronze',
      division: rank?.division || 3,
    }
  })
  
  // 총 자본 기준으로 내림차순 정렬
  const sortedUsers = usersWithTotalCapital.sort((a, b) => b.total_capital - a.total_capital)

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LeaderboardClient users={sortedUsers} />
    </Suspense>
  )
}
