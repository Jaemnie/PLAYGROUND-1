'use client'

import { useState, useEffect } from 'react'
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
  const [newRequestsCount, setNewRequestsCount] = useState(0)
  
  // 이전 요청 수를 추적하여 새 요청이 왔는지 확인
  useEffect(() => {
    // 로컬 스토리지에서 마지막으로 확인한 요청 수 가져오기
    const lastCheckedCount = parseInt(localStorage.getItem('lastCheckedRequestsCount') || '0')
    
    if (pendingRequests.length > lastCheckedCount) {
      // 새 요청이 있으면 카운터 업데이트 및 알림 표시
      setNewRequestsCount(pendingRequests.length - lastCheckedCount)
      
      if (pendingRequests.length > 0 && lastCheckedCount < pendingRequests.length) {
        // 새 친구 요청 알림 표시
        toast.info('새로운 친구 요청이 있습니다!')
      }
    }
    
    // 컴포넌트가 마운트되면 현재 요청 수를 저장
    return () => {
      localStorage.setItem('lastCheckedRequestsCount', pendingRequests.length.toString())
      setNewRequestsCount(0)
    }
  }, [pendingRequests.length])
  
  const handleAddFriend = async () => {
    if (!searchEmail.trim()) {
      toast.error('이메일을 입력해주세요')
      return
    }
    
    setIsSearching(true)
    const supabase = createClientBrowser()
    
    try {
      // 먼저 auth.users 테이블에서 이메일로 사용자 ID 찾기
      const { data: authUser, error: authError } = await supabase
        .rpc('get_user_id_by_email', { email_input: searchEmail })

      if (authError || !authUser) {
        toast.error('해당 이메일의 사용자를 찾을 수 없습니다')
        setIsSearching(false)
        return
      }
      
      // 이제 찾은 사용자 ID로 프로필 정보 가져오기
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUser)
        .single()
        
      if (userError || !userData) {
        toast.error('해당 이메일의 사용자를 찾을 수 없습니다')
        return
      }
      
      if (userData.id === userId) {
        toast.error('자신을 친구로 추가할 수 없습니다')
        return
      }
      
      const checkResult = await checkExistingFriendship(userId, userData.id)
      
      if (checkResult.error) {
        toast.error('친구 확인 중 오류가 발생했습니다')
        setIsSearching(false)
        return
      }
      
      if (checkResult.relationship) {
        // 이미 친구 관계가 있음
        const relationship = checkResult.relationship
        
        if (relationship.status === 'accepted') {
          toast.error('이미 친구입니다')
        } else if (relationship.status === 'pending') {
          toast.error('이미 친구 요청이 진행 중입니다')
        } else if (relationship.status === 'rejected') {
          toast.error('이전에 거절된 친구 요청입니다')
        } else {
          toast.error('이미 친구 관계가 있습니다')
        }
        
        setIsSearching(false)
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
        console.error('친구 요청 오류:', requestError)
        toast.error('친구 요청 중 오류가 발생했습니다')
        return
      }
      
      toast.success(`${searchEmail}님에게 친구 요청을 보냈습니다`)
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
  
  const checkExistingFriendship = async (userId: string, friendId: string) => {
    const supabase = createClientBrowser()
    
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
    
    if (error) {
      console.error('친구 관계 확인 오류:', error)
      return { error, relationship: null }
    }
    
    return { error: null, relationship: data && data.length > 0 ? data[0] : null }
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
        <Card className="bg-black/40 backdrop-blur-sm border-gray-800 relative">
          {newRequestsCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              {newRequestsCount}
            </div>
          )}
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
