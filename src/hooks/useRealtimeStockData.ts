import { useEffect, useState } from 'react'
import { redis } from '@/lib/upstash-client'
import { createClientBrowser } from '@/lib/supabase/client'

interface StockPrice {
  current_price: number;
  last_closing_price: number;
  previous_price: number;
  timestamp: number;
}

export function useRealtimeStockData(companyIds: string[]) {
  const [stockData, setStockData] = useState(new Map())
  const [changes, setChanges] = useState(new Set())

  useEffect(() => {
    // 초기 데이터 로드
    const loadInitialData = async () => {
      const cachedData = await Promise.all(
        companyIds.map(async (id) => {
          const key = `stock:${id}`
          const cached = await redis.get(key)
          return { id, data: cached }
        })
      )
      
      const initialData = new Map()
      cachedData.forEach(({ id, data }) => {
        if (data) initialData.set(id, data)
      })
      
      setStockData(initialData)
    }
    
    loadInitialData()

    // Supabase Realtime 구독
    const supabase = createClientBrowser()
    const channel = supabase
      .channel('stock-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=in.(${companyIds.join(',')})`
        },
        (payload) => {
          setStockData(prev => new Map(prev).set(payload.new.id, payload.new))
          setChanges(prev => new Set(prev).add(payload.new.id))
          
          // 변화 표시를 잠시 후 제거
          setTimeout(() => {
            setChanges(prev => {
              const next = new Set(prev)
              next.delete(payload.new.id)
              return next
            })
          }, 1000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [JSON.stringify(companyIds)])

  return { stockData, changes }
}
