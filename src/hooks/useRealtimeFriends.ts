import { useState, useEffect } from 'react'
import { createClientBrowser } from '@/lib/supabase/client'

export interface Friend {
  id: string
  user_id: string
  friend_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  profile: {
    nickname: string
  }
}

export function useRealtimeFriends(userId: string) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])
  
  useEffect(() => {
    const fetchFriends = async () => {
      const supabase = createClientBrowser()
      
      // 1. 친구 목록 가져오기 (조인 없이)
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'accepted')
        
      if (friendsError) {
        console.error('친구 목록 가져오기 오류:', friendsError)
        return
      }
      
      // 2. 친구 요청 가져오기 (조인 없이)
      const { data: requestsData, error: requestsError } = await supabase
        .from('friends')
        .select('*')
        .eq('friend_id', userId)
        .eq('status', 'pending')
        
      if (requestsError) {
        console.error('친구 요청 가져오기 오류:', requestsError)
        return
      }
      
      // 3. 친구 프로필 정보 가져오기 (avatar_url 제외)
      if (friendsData && friendsData.length > 0) {
        const friendIds = friendsData.map(f => f.friend_id)
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nickname')  // avatar_url 제거
          .in('id', friendIds)
          
        // 프로필 정보 합치기
        const friendsWithProfiles = friendsData.map(friend => {
          const profile = profilesData?.find(p => p.id === friend.friend_id) || { nickname: '알 수 없음' }
          return { ...friend, profile }
        })
        
        setFriends(friendsWithProfiles)
      } else {
        setFriends([])
      }
      
      // 4. 친구 요청 프로필 정보 가져오기 (avatar_url 제외)
      if (requestsData && requestsData.length > 0) {
        const requesterIds = requestsData.map(r => r.user_id)
        const { data: requesterProfiles } = await supabase
          .from('profiles')
          .select('id, nickname')  // avatar_url 제거
          .in('id', requesterIds)
          
        // 프로필 정보 합치기
        const requestsWithProfiles = requestsData.map(request => {
          const profile = requesterProfiles?.find(p => p.id === request.user_id) || { nickname: '알 수 없음' }
          return { ...request, profile }
        })
        
        setPendingRequests(requestsWithProfiles)
      } else {
        setPendingRequests([])
      }
    }
    
    fetchFriends()
    
    // 실시간 구독 설정
    const supabase = createClientBrowser()
    const friendsSubscription = supabase
      .channel('friends-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => {
        fetchFriends()
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(friendsSubscription)
    }
  }, [userId])
  
  return { friends, pendingRequests }
}