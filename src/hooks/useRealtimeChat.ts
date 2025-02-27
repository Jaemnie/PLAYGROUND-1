import { useState, useEffect } from 'react'
import { createClientBrowser } from '@/lib/supabase/client'

export interface Message {
  id: string
  chat_room_id: string
  user_id: string
  content: string
  created_at: string
  is_read: boolean
  profile: {
    nickname: string
    avatar_url?: string
  }
}

export interface ChatRoom {
  id: string
  name: string
  is_group: boolean
  created_at: string
  last_message?: Message
  participants: {
    user_id: string
    profile: {
      nickname: string
      avatar_url?: string
    }
  }[]
}

export function useRealtimeChat(userId: string) {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  
  useEffect(() => {
    const supabase = createClientBrowser()
    
    // 사용자의 모든 채팅방 로드
    const loadChatRooms = async () => {
      const { data, error } = await supabase
        .from('chat_participants')
        .select(`
          chat_room:chat_rooms(
            id, 
            name, 
            is_group, 
            created_at,
            participants:chat_participants(
              user_id,
              profile:profiles!user_id(nickname, avatar_url)
            )
          )
        `)
        .eq('user_id', userId)
        
      if (data) {
        // 각 채팅방의 마지막 메시지 로드
        const roomsWithLastMessage = await Promise.all(
          data.map(async (item) => {
            // 배열인 경우 첫 번째 요소 사용
            const chatRoom = Array.isArray(item.chat_room) ? item.chat_room[0] : item.chat_room
            
            // 참가자 정보 정규화
            const normalizedParticipants = chatRoom.participants.map((p: any) => ({
              user_id: p.user_id,
              profile: Array.isArray(p.profile) ? p.profile[0] : p.profile
            }))

            const { data: lastMessage } = await supabase
              .from('messages')
              .select(`
                *,
                profile:profiles!user_id(nickname, avatar_url)
              `)
              .eq('chat_room_id', chatRoom.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
              
            return {
              ...chatRoom,
              participants: normalizedParticipants,
              last_message: lastMessage || undefined
            }
          })
        )
        
        setChatRooms(roomsWithLastMessage)
      }
    }
    
    loadChatRooms()
    
    // 채팅방 변경 구독
    const roomsChannel = supabase
      .channel('chat-rooms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_participants',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadChatRooms()
        }
      )
      .subscribe()
      
    return () => {
      supabase.removeChannel(roomsChannel)
    }
  }, [userId])
  
  // 특정 채팅방의 메시지 로드 및 구독
  useEffect(() => {
    if (!activeRoom) return
    
    const supabase = createClientBrowser()
    
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profile:profiles!user_id(nickname, avatar_url)
        `)
        .eq('chat_room_id', activeRoom)
        .order('created_at', { ascending: true })
        
      if (data) {
        setMessages(data)
      }
    }
    
    loadMessages()
    
    // 메시지 읽음 상태로 업데이트
    const updateReadStatus = async () => {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('chat_room_id', activeRoom)
        .neq('user_id', userId)
        .eq('is_read', false)
    }
    
    updateReadStatus()
    
    // 새 메시지 구독
    const messagesChannel = supabase
      .channel(`chat-messages-${activeRoom}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${activeRoom}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // 새 메시지가 추가되면 메시지 목록에 추가
            setMessages(prev => [...prev, payload.new as Message])
            
            // 내가 보낸 메시지가 아니면 읽음 상태로 업데이트
            if (payload.new.user_id !== userId) {
              updateReadStatus()
            }
          }
        }
      )
      .subscribe()
      
    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [activeRoom, userId])
  
  return { 
    chatRooms, 
    messages, 
    activeRoom, 
    setActiveRoom 
  }
}
