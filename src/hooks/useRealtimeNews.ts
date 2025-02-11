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
    
    // 고정된 채널 이름 사용
    const channelName = 'realtime-news'
    const subscription = supabase
      .channel(channelName)
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
        }
      )
      .subscribe()
      
    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])
  
  return { newsData, latestUpdate }
} 