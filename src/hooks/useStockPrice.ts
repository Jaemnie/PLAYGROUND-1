import { useEffect, useState } from 'react'
// 직접 Redis 접근 제거
// import { redis } from '@/lib/upstash-client'
import { createClientBrowser } from '@/lib/supabase/client'

export function useStockPrice(ticker: string) {
  const [price, setPrice] = useState<number>(0)

  useEffect(() => {
    const fetchInitialPrice = async () => {
      try {
        // API를 통해 데이터 가져오기
        const response = await fetch(`/api/stock/market/${ticker}`)
        const data = await response.json()
        if (data.company && data.company.current_price) {
          setPrice(data.company.current_price)
        }
      } catch (error) {
        console.error('주식 가격 가져오기 실패:', error)
      }
    }

    fetchInitialPrice()

    // Supabase Realtime 구독
    const supabase = createClientBrowser()
    const channel = supabase
      .channel(`stock-${ticker}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `ticker=eq.${ticker}`
        },
        (payload) => {
          setPrice(payload.new.current_price)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticker])

  return price
}
