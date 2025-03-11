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
  const [newItemsCount, setNewItemsCount] = useState<number>(0)
  
  useEffect(() => {
    const supabase = createClientBrowser()
    
    // 고정된 채널 이름 사용
    const channelName = 'realtime-news'
    
    // 마지막 업데이트 시간 추적
    let lastUpdateTime = new Date().getTime()
    let recentUpdates: NewsItem[] = []
    
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
          const currentTime = new Date().getTime()
          
          // 새 뉴스 아이템을 상태에 추가
          setNewsData(prev => [newItem, ...prev])
          
          // 최근 5초 이내에 추가된 뉴스를 추적
          if (currentTime - lastUpdateTime < 5000) {
            // 최근 업데이트 배열에 추가
            recentUpdates.push(newItem)
          } else {
            // 5초 이상 지났으면 새로운 업데이트 세션 시작
            recentUpdates = [newItem]
          }
          
          // 최근 추가된 뉴스 개수 업데이트
          setNewItemsCount(recentUpdates.length)
          
          // 가장 최근 업데이트 ID 설정
          setLatestUpdate(newItem.id)
          
          // 마지막 업데이트 시간 갱신
          lastUpdateTime = currentTime
        }
      )
      .subscribe()
      
    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])
  
  // 새 뉴스 알림 초기화 함수
  const resetNewItemsCount = () => {
    setNewItemsCount(0)
  }
  
  return { newsData, latestUpdate, newItemsCount, resetNewItemsCount }
} 