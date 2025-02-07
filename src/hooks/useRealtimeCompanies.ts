'use client'

import { useEffect, useState } from 'react'
import { createClientBrowser } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  current_price: number
  // 필요한 추가 필드가 있다면 이곳에 선언
}

export function useRealtimeCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])

  useEffect(() => {
    const supabase = createClientBrowser()

    // 1. 초기 REST API 호출로 데이터를 한 번 불러옵니다.
    supabase
      .from<"companies", Company>('companies')
      .select('*')
      .then(({ data, error }) => {
        if (error) {
          console.error('초기 데이터 로드 오류:', error)
          return
        }
        if (data) {
          setCompanies(data)
        }
      })

    // 2. 올바른 채널 이름과 구독 파라미터 사용
    const realtimeChannel = supabase
      .channel('company-real-time-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        (payload: any) => {
          console.log('리얼타임 이벤트 수신:', payload)
          // 이벤트 타입에 따라 상태 업데이트
          if (payload.eventType === 'INSERT') {
            setCompanies(prev => [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setCompanies(prev =>
              prev.map(company =>
                company.id === payload.new.id ? payload.new : company
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setCompanies(prev =>
              prev.filter(company => company.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    // 3. 컴포넌트 언마운트 시 구독 해제하여 리소스 누수를 방지합니다.
    return () => {
      supabase.removeChannel(realtimeChannel)
    }
  }, [])

  return companies
} 