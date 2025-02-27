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
    avatar_url?: string
  }
}

export function useRealtimeFriends(userId: string) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])
  
  useEffect(() => {
    const supabase = createClientBrowser()
    
    // 초기 데이터 로드
    const loadFriends = async () => {
      // 내가 친구 요청을 보낸 사람들 + 수락된 친구들
      const { data: myFriends, error: myFriendsError } = await supabase
        .from('friends')
        .select(`
          *,
          profile:profiles!friend_id(nickname, avatar_url)
        `)
        .eq('user_id', userId)
        
      // 나에게 친구 요청을 보낸 사람들
      const { data: friendRequests, error: requestsError } = await supabase
        .from('friends')
        .select(`
          *,
          profile:profiles!user_id(nickname, avatar_url)
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending')
        
      if (myFriends) {
        setFriends(myFriends.filter(f => f.status === 'accepted'))
      }
      
      if (friendRequests) {
        setPendingRequests(friendRequests)
      }
    }
    
    loadFriends()
    
    // 실시간 구독
    const friendsChannel = supabase
      .channel('friends-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'friends',
          filter: `user_id=eq.${userId}` 
        },
        (payload) => {
          loadFriends() // 변경 시 전체 데이터 다시 로드
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'friends',
          filter: `friend_id=eq.${userId}` 
        },
        (payload) => {
          loadFriends() // 변경 시 전체 데이터 다시 로드
        }
      )
      .subscribe()
      
    return () => {
      supabase.removeChannel(friendsChannel)
    }
  }, [userId])
  
  return { friends, pendingRequests }
}