'use client'

import { useState, useRef, useEffect } from 'react'
import { useRealtimeChat } from '@/hooks/useRealtimeChat'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageSquare, Send, User, Users, Trash2, X } from 'lucide-react'
import { createClientBrowser } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from 'sonner'

interface ChatInterfaceProps {
  userId: string
  userNickname: string
}

export function ChatInterface({ userId, userNickname }: ChatInterfaceProps) {
  const { chatRooms, messages, activeRoom, setActiveRoom, removeChatRoom } = useRealtimeChat(userId)
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null)
  
  useEffect(() => {
    // 새 메시지가 추가될 때마다 스크롤을 아래로 이동
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeRoom) return
    
    const supabase = createClientBrowser()
    
    try {
      await supabase
        .from('messages')
        .insert({
          chat_room_id: activeRoom,
          user_id: userId,
          content: newMessage.trim()
        })
      
      setNewMessage('')
    } catch (error) {
      console.error('메시지 전송 오류:', error)
    }
  }
  
  const handleDeleteRoom = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation() // 채팅방 선택 이벤트 방지
    setRoomToDelete(roomId)
    setIsDeleteDialogOpen(true)
  }
  
  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return
    
    try {
      const supabase = createClientBrowser()
      
      // 1. 채팅방의 메시지 삭제
      await supabase
        .from('messages')
        .delete()
        .eq('chat_room_id', roomToDelete)
      
      // 2. 채팅방 참여자 정보 삭제
      await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_room_id', roomToDelete)
        .eq('user_id', userId)
      
      // 3. 로컬 상태 업데이트
      if (removeChatRoom) {
        removeChatRoom(roomToDelete)
      }
      
      // 4. 활성 채팅방이 삭제된 경우 다른 채팅방으로 이동
      if (activeRoom === roomToDelete) {
        const remainingRooms = chatRooms.filter(room => room.id !== roomToDelete)
        setActiveRoom(remainingRooms.length > 0 ? remainingRooms[0].id : null)
      }
      
      toast.success('채팅방이 삭제되었습니다')
    } catch (error) {
      console.error('채팅방 삭제 오류:', error)
      toast.error('채팅방 삭제 중 오류가 발생했습니다')
    } finally {
      setIsDeleteDialogOpen(false)
      setRoomToDelete(null)
    }
  }
  
  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* 채팅방 목록 */}
      <Card className="w-1/4 bg-black/40 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-gray-100">채팅</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {chatRooms.map((room) => {
              const otherParticipant = room.participants.find(p => p.user_id !== userId)
              const roomName = room.is_group 
                ? room.name 
                : (otherParticipant?.profile.nickname || '알 수 없음')
              
              return (
                <div 
                  key={room.id}
                  onClick={() => setActiveRoom(room.id)}
                  className={`p-3 rounded-lg cursor-pointer flex justify-between items-center ${
                    activeRoom === room.id 
                      ? 'bg-blue-600/20 border border-blue-500/50' 
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      {room.is_group ? (
                        <Users className="w-5 h-5 text-gray-300" />
                      ) : (
                        <User className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-200">{roomName}</p>
                      {room.last_message && (
                        <p className="text-sm text-gray-400 truncate">
                          {room.last_message.content}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* 삭제 버튼 추가 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                    onClick={(e) => handleDeleteRoom(room.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* 채팅 내용 */}
      <Card className="flex-1 flex flex-col bg-black/40 backdrop-blur-sm border-gray-800 rounded-none">
        {activeRoom ? (
          <>
            <CardHeader className="border-b border-gray-800 py-4">
              {(() => {
                const room = chatRooms.find(r => r.id === activeRoom)
                if (!room) return null
                
                const otherParticipant = room.participants.find(p => p.user_id !== userId)
                const roomName = room.is_group 
                  ? room.name 
                  : (otherParticipant?.profile.nickname || '알 수 없음')
                  
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                      {room.is_group ? (
                        <Users className="w-4 h-4 text-gray-300" />
                      ) : (
                        <User className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-100">{roomName}</h2>
                  </div>
                )
              })()}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.user_id === userId ? 'justify-end' : 'justify-start'} mb-4`}
                    >
                      {message.user_id !== userId && (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-2">
                          <User className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div>
                        {message.user_id !== userId && (
                          <p className="text-xs text-gray-400 mb-1">{message.user.nickname}</p>
                        )}
                        <div 
                          className={`px-4 py-2 rounded-lg ${
                            message.user_id === userId 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-700 text-gray-200'
                          }`}
                        >
                          {message.content}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(message.created_at), 'a h:mm', { locale: ko })}
                        </p>
                      </div>
                      {message.user_id === userId && (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center ml-2">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </CardContent>
            <div className="p-4 border-t border-gray-800">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="메시지를 입력하세요..."
                  className="bg-black/30 border-gray-700"
                />
                <Button
                  onClick={handleSendMessage}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">채팅방을 선택하거나 새로운 대화를 시작하세요</p>
            </div>
          </div>
        )}
      </Card>
      
      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">채팅방 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              이 채팅방을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 대화 내용이 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100">
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteRoom}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 