import { useEffect, useState } from 'react'
import { createClientBrowser } from '@/lib/supabase/client'

export function useStockPrice(companyId: string) {
  const [price, setPrice] = useState<number>(0)
  
  useEffect(() => {
    const supabase = createClientBrowser()
    
    // 초기 가격 로드
    supabase
      .from('companies')
      .select('current_price')
      .eq('id', companyId)
      .single()
      .then(({ data }) => {
        if (data) setPrice(data.current_price)
      })
    
    // 실시간 가격 업데이트 구독
    const subscription = supabase
      .channel('price_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${companyId}`
        },
        (payload) => {
          setPrice(payload.new.current_price)
        }
      )
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [companyId])
  
  return price
}
