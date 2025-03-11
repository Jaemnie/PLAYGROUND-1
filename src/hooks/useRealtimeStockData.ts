import { useEffect, useState } from 'react'
// 직접 Redis 접근 제거
// import { redis } from '@/lib/upstash-client'
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
      try {
        // API를 통해 데이터 가져오기
        const response = await fetch(`/api/stock/batch?tickers=${companyIds.join(',')}`)
        const data = await response.json()
        
        if (data.companies) {
          const initialData = new Map()
          Object.entries(data.companies).forEach(([id, companyData]) => {
            initialData.set(id, companyData)
          })
          setStockData(initialData)
        }
      } catch (error) {
        console.error('주식 데이터 로드 실패:', error)
      }
    }
    
    if (companyIds.length > 0) {
      loadInitialData()
    }

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
