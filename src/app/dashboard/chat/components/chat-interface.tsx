import React, { useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, MessageSquare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface ChatInterfaceProps {
  userId: string
  userNickname: string
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userId, userNickname }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSendMessage = () => {
    // Implementation of handleSendMessage
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="w-full max-w-4xl">
        {messages.length > 0 ? (
          <>
            <CardContent className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const isMyMessage = message.user_id === userId
                    
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${isMyMessage ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-gray-800 border border-gray-700'} rounded-lg p-3`}>
                          {!isMyMessage && (
                            <p className="text-sm font-medium text-gray-300 mb-1">
                              {message.profile.nickname}
                            </p>
                          )}
                          <p className="text-gray-200">{message.content}</p>
                          <p className="text-xs text-gray-400 mt-1 text-right">
                            {format(new Date(message.created_at), 'a h:mm', { locale: ko })}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
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
    </div>
  )
}

export default ChatInterface 