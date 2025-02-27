'use client'

import { useState } from 'react'
import { useRealtimeFriends, Friend } from '@/hooks/useRealtimeFriends'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserCircle, UserPlus, Check, X } from 'lucide-react'
import { createClientBrowser } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface FriendsListProps {
  userId: string
}

export function FriendsList({ userId }: FriendsListProps) {
  const { friends, pendingRequests } = useRealtimeFriends(userId)
  const [searchEmail, setSearchEmail] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  const handleAddFriend = async () => {
    if (!searchEmail.trim()) {
      toast.error('이메일을 입력해주세요')
      return
    }
    
    setIsSearching(true)
    const supabase = createClientBrowser()
    
    try {
      // 사용자 검색
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', searchEmail)
        .single()
        
      if (userError || !userData) {
        toast.error('해당 이메일의 사용자를 찾을 수 없습니다')
        return
      }
      
      if (userData.id === userId) {
        toast.error('자신을 친구로 추가할 수 없습니다')
        return
      }
      
      // 이미 친구인지 확인
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${userData.id}),and(user_id.eq.${userData.id},friend_id.eq.${userId})`)
        .single()
        
      if (existingFriend) {
        toast.error('이미 친구이거나 친구 요청이 진행 중입니다')
        return
      }
      
      // 친구 요청 보내기
      const { error: requestError } = await supabase
        .from('friends')
        .insert({
          user_id: userId,
          friend_id: userData.id,
          status: 'pending'
        })
        
      if (requestError) {
        toast.error('친구 요청 중 오류가 발생했습니다')
        return
      }
      
      toast.success('친구 요청을 보냈습니다')
      setSearchEmail('')
    } catch (error) {
      console.error('Error adding friend:', error)
      toast.error('오류가 발생했습니다')
    } finally {
      setIsSearching(false)
    }
  }
  
  const handleAcceptRequest = async (friendId: string) => {
    const supabase = createClientBrowser()
    
    try {
      // 친구 요청 수락
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        
      if (error) {
        toast.error('요청 수락 중 오류가 발생했습니다')
        return
      }
      
      // 양방향 친구 관계 생성
      const { error: insertError } = await supabase
        .from('friends')
        .insert({
          user_id: userId,
          friend_id: friendId,
          status: 'accepted'
        })
        
      if (insertError) {
        console.error('Error creating reverse friendship:', insertError)
      }
      
      toast.success('친구 요청을 수락했습니다')
    } catch (error) {
      console.error('Error accepting friend request:', error)
      toast.error('오류가 발생했습니다')
    }
  }
  
  const handleRejectRequest = async (friendId: string) => {
    const supabase = createClientBrowser()
    
    try {
      const { error } = await supabase
        .from('friends')
        .update({ status: 'rejected' })
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        
      if (error) {
        toast.error('요청 거절 중 오류가 발생했습니다')
        return
      }
      
      toast.success('친구 요청을 거절했습니다')
    } catch (error) {
      console.error('Error rejecting friend request:', error)
      toast.error('오류가 발생했습니다')
    }
  }
  
  return (
    <div className="space-y-6">
      {/* 친구 검색 */}
      <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-gray-100">친구 추가</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="친구의 이메일 주소를 입력하세요"
              className="bg-black/30 border-gray-700"
            />
            <Button
              onClick={handleAddFriend}
              disabled={isSearching}
              className="bg-blue-500 hover:bg-blue-600"
            >
              추가
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* 친구 요청 */}
      {pendingRequests.length > 0 && (
        <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-yellow-400" />
              <h2 className="text-xl font-bold text-gray-100">친구 요청</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-gray-300" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-200">{request.profile.nickname}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptRequest(request.user_id)}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectRequest(request.user_id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 친구 목록 */}
      <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-gray-100">내 친구</h2>
          </div>
        </CardHeader>
        <CardContent>
          {friends.length === 0 ? (
            <p className="text-gray-400 text-center py-4">아직 친구가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {friends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-gray-300" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-200">{friend.profile.nickname}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700"
                  >
                    메시지
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
