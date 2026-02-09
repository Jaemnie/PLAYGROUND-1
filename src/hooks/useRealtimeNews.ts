import { useState, useEffect } from 'react'
import { createClientBrowser } from '@/lib/supabase/client'
import { toast } from 'sonner'

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
          const newItem = payload.new as NewsItem
          
          // 뉴스 목록에 추가
          setNewsData(prev => [newItem, ...prev])
          setLatestUpdate(newItem.id)
          
          // 토스트 알림
          const sentimentIcon = 
            newItem.impact === 'positive' ? '📈' :
            newItem.impact === 'negative' ? '📉' : '📰'
          
          toast(newItem.title, {
            description: newItem.content?.slice(0, 60) + (newItem.content?.length > 60 ? '...' : ''),
            icon: sentimentIcon,
            duration: 4000,
          })
        }
      )
      .subscribe()
      
    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])
  
  return { newsData, latestUpdate }
}
