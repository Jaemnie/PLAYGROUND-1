import { useState, useEffect } from 'react'
import { createClientBrowser } from '@/lib/supabase/client'

export function useRealtimeStockData(companyIds: string[]) {
  const [stockData, setStockData] = useState<Map<string, any>>(new Map())
  const [changes, setChanges] = useState<Map<string, number>>(new Map())
  
  useEffect(() => {
    const supabase = createClientBrowser()
    
    const loadInitialData = async () => {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds)
      
      if (data) {
        const newStockData = new Map(data.map(company => [company.id, company]))
        setStockData(newStockData)
      }
    }
    
    loadInitialData()
    
    const subscription = supabase
      .channel('stock_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=in.(${companyIds.join(',')})`
        },
        (payload) => {
          setStockData(prev => {
            const newMap = new Map(prev)
            const oldPrice = prev.get(payload.new.id)?.current_price || 0
            const priceChange = payload.new.current_price - oldPrice
            
            setChanges(prev => {
              const newChanges = new Map(prev)
              newChanges.set(payload.new.id, priceChange)
              return newChanges
            })
            
            newMap.set(payload.new.id, payload.new)
            return newMap
          })
        }
      )
      .subscribe()
      
    return () => {
      subscription.unsubscribe()
    }
  }, [companyIds])
  
  return { stockData, changes }
}
