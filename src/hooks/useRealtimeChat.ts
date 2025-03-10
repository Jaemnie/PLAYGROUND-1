import { useState, useEffect } from 'react'
import { createClientBrowser } from '@/lib/supabase/client'

export interface Message {
  id: string
  chat_room_id: string
  user_id: string
  content: string
  created_at: string
  user: {
    id: string
    nickname: string
  }
}

export interface ChatRoom {
  id: string
  name: string
  created_at: string
  is_group: boolean
  last_message?: {
    content: string
  }
  participants: {
    user_id: string
    profile: {
      nickname: string
    }
  }[]
}

export function useRealtimeChat(userId: string) {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchChatRooms = async () => {
      const supabase = createClientBrowser()
      
      // 1. 사용자가 참여한 채팅방 ID 가져오기
      const { data: participantsData, error: participantsError } = await supabase
        .from('chat_participants')
        .select('chat_room_id')
        .eq('user_id', userId)
        
      if (participantsError) {
        console.error('채팅방 참여 정보 가져오기 오류:', participantsError)
        return
      }
      
      if (!participantsData || participantsData.length === 0) {
        setChatRooms([])
        return
      }
      
      // 2. 채팅방 정보 가져오기
      const roomIds = participantsData.map(p => p.chat_room_id)
      const { data: roomsData, error: roomsError } = await supabase
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds)
        
      if (roomsError) {
        console.error('채팅방 정보 가져오기 오류:', roomsError)
        return
      }
      
      // 3. 각 채팅방의 참여자 정보 가져오기
      const roomsWithParticipants = await Promise.all(roomsData.map(async (room) => {
        const { data: roomParticipants, error: roomParticipantsError } = await supabase
          .from('chat_participants')
          .select('user_id')
          .eq('chat_room_id', room.id)
          
        if (roomParticipantsError) {
          console.error('채팅방 참여자 정보 가져오기 오류:', roomParticipantsError)
          return room
        }
        
        // 4. 참여자 프로필 정보 가져오기 (avatar_url 제외)
        const participantIds = roomParticipants.map(p => p.user_id)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, nickname')  // avatar_url 제외
          .in('id', participantIds)
          
        if (profilesError) {
          console.error('프로필 정보 가져오기 오류:', profilesError)
          return room
        }
        
        // 참여자 정보와 프로필 정보 합치기
        const participants = roomParticipants.map(participant => {
          const profile = profilesData?.find(p => p.id === participant.user_id) || { nickname: '알 수 없음' }
          return {
            user_id: participant.user_id,
            profile
          }
        })
        
        return {
          ...room,
          participants
        }
      }))
      
      setChatRooms(roomsWithParticipants)
      
      // 첫 번째 채팅방을 활성화
      if (roomsWithParticipants.length > 0 && !activeRoom) {
        setActiveRoom(roomsWithParticipants[0].id)
      }
    }
    
    fetchChatRooms()
    
    // 실시간 구독 설정
    const supabase = createClientBrowser()
    const chatSubscription = supabase
      .channel('chat-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants' }, () => {
        fetchChatRooms()
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(chatSubscription)
    }
  }, [userId, activeRoom])
  
  // 활성화된 채팅방의 메시지 가져오기
  useEffect(() => {
    if (!activeRoom) return
    
    const fetchMessages = async () => {
      const supabase = createClientBrowser()
      
      // 메시지 가져오기
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_room_id', activeRoom)
        .order('created_at', { ascending: true })
        
      if (messagesError) {
        console.error('메시지 가져오기 오류:', messagesError)
        return
      }
      
      // 메시지 작성자 정보 가져오기
      if (messagesData && messagesData.length > 0) {
        const userIds = [...new Set(messagesData.map(m => m.user_id))]
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, nickname')  // avatar_url 제외
          .in('id', userIds)
          
        if (profilesError) {
          console.error('프로필 정보 가져오기 오류:', profilesError)
          return
        }
        
        // 메시지와 작성자 정보 합치기
        const messagesWithUser = messagesData.map(message => {
          const profile = profilesData?.find(p => p.id === message.user_id) || { nickname: '알 수 없음' }
          return {
            ...message,
            user: {
              id: message.user_id,
              nickname: profile.nickname
            }
          }
        })
        
        setMessages(messagesWithUser)
      } else {
        setMessages([])
      }
    }
    
    fetchMessages()
    
    // 실시간 구독 설정
    const supabase = createClientBrowser()
    const messagesSubscription = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${activeRoom}` }, () => {
        fetchMessages()
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(messagesSubscription)
    }
  }, [activeRoom])
  
  // 채팅방 삭제 함수 추가
  const removeChatRoom = (roomId: string) => {
    setChatRooms(prev => prev.filter(room => room.id !== roomId))
  }
  
  return { chatRooms, messages, activeRoom, setActiveRoom, removeChatRoom }
}
