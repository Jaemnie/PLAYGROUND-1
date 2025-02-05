import { useState, useEffect } from 'react'
import { createClientBrowser } from '@/lib/supabase/client'

interface NewsItem {
  id: string
  title: string
  content: string
  published_at: string
  impact: 'positive' | 'negative' | 'neutral'
  related_company_id?: string
}

export function useRealtimeNews(initialNews: NewsItem[]) {
  const [newsData, setNewsData] = useState<NewsItem[]>(initialNews)
  const [latestUpdate, setLatestUpdate] = useState<string | null>(null)
  
  useEffect(() => {
    const supabase = createClientBrowser()
    
    const subscription = supabase
      .channel('news_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'news'
        },
        (payload) => {
          setNewsData(prev => [payload.new as NewsItem, ...prev])
          setLatestUpdate(payload.new.id)
          
          // 3초 후 최신 업데이트 표시 제거
          setTimeout(() => {
            setLatestUpdate(null)
          }, 3000)
        }
      )
      .subscribe()
      
    return () => {
      subscription.unsubscribe()
    }
  }, [])
  
  return { newsData, latestUpdate }
} 