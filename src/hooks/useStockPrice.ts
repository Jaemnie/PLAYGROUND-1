import { useEffect, useState } from 'react'
import { redis } from '@/lib/upstash-client'
import { createClientBrowser } from '@/lib/supabase/client'

export function useStockPrice(ticker: string) {
  const [price, setPrice] = useState<number>(0)

  useEffect(() => {
    const fetchInitialPrice = async () => {
      const cacheKey = `stock:${ticker}`
      const cachedData = await redis.get(cacheKey) as { current_price: number } | null
      
      if (cachedData) {
        setPrice(cachedData.current_price)
      } else {
        const response = await fetch(`/api/stock/market/${ticker}`)
        const data = await response.json()
        setPrice(data.company.current_price)
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
