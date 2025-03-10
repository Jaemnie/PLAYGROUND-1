'use client'

import { useState, useEffect } from 'react'
import { useRealtimeFriends, Friend } from '@/hooks/useRealtimeFriends'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserCircle, UserPlus, Check, X } from 'lucide-react'
import { createClientBrowser } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FriendsListProps {
  userId: string
}

export function FriendsList({ userId }: FriendsListProps) {
  const { friends, pendingRequests } = useRealtimeFriends(userId)
  const [searchNickname, setSearchNickname] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [newRequestsCount, setNewRequestsCount] = useState(0)
  const router = useRouter()
  
  // 친구 삭제 확인 다이얼로그 상태
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [friendToDelete, setFriendToDelete] = useState<{ id: string, nickname: string } | null>(null)
  
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
    if (!searchNickname.trim()) {
      toast.error('닉네임을 입력해주세요')
      return
    }
    
    setIsSearching(true)
    const supabase = createClientBrowser()
    
    try {
      console.log('친구 추가 시도:', searchNickname)
      
      // 먼저 auth.users 테이블에서 닉네임으로 사용자 ID 찾기 (관리자 권한 필요)
      // 대신 사용자 검색 API를 사용하거나 다른 방법으로 구현해야 함
      
      // 임시 방법: 닉네임으로 검색 (이메일 대신)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, nickname')
        .ilike('nickname', `%${searchNickname}%`)
        .maybeSingle()

      console.log('프로필 조회 결과:', { profileData, profileError })

      if (profileError) {
        console.error('프로필 조회 오류:', profileError)
        toast.error('사용자 검색 중 오류가 발생했습니다')
        setIsSearching(false)
        return
      }
      
      if (!profileData) {
        console.log('사용자를 찾을 수 없음')
        toast.error('해당 사용자를 찾을 수 없습니다. 정확한 닉네임을 입력해주세요.')
        setIsSearching(false)
        return
      }
      
      if (profileData.id === userId) {
        console.log('자신을 친구로 추가 시도')
        toast.error('자신을 친구로 추가할 수 없습니다')
        setIsSearching(false)
        return
      }
      
      const checkResult = await checkExistingFriendship(userId, profileData.id)
      console.log('친구 관계 확인 결과:', checkResult)
      
      if (checkResult.error) {
        console.error('친구 관계 확인 오류:', checkResult.error)
        toast.error('친구 확인 중 오류가 발생했습니다')
        setIsSearching(false)
        return
      }
      
      if (checkResult.relationship) {
        // 이미 친구 관계가 있음
        const relationship = checkResult.relationship
        console.log('기존 친구 관계:', relationship)
        
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
      console.log('친구 요청 보내기:', { userId, friendId: profileData.id })
      const { error: requestError } = await supabase
        .from('friends')
        .insert({
          user_id: userId,
          friend_id: profileData.id,
          status: 'pending'
        })
        
      if (requestError) {
        console.error('친구 요청 오류:', requestError)
        toast.error('친구 요청 중 오류가 발생했습니다')
        setIsSearching(false)
        return
      }
      
      console.log('친구 요청 성공')
      toast.success(`${profileData.nickname}님에게 친구 요청을 보냈습니다`)
      setSearchNickname('')
    } catch (error) {
      console.error('친구 추가 중 예외 발생:', error)
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
      
      // 사용자의 친구 수 업데이트
      await updateFriendCount(userId)
      // 친구의 친구 수 업데이트
      await updateFriendCount(friendId)
      
      toast.success('친구 요청을 수락했습니다')
    } catch (error) {
      console.error('Error accepting friend request:', error)
      toast.error('오류가 발생했습니다')
    }
  }
  
  // 친구 수 업데이트 함수
  const updateFriendCount = async (userId: string) => {
    const supabase = createClientBrowser()
    
    try {
      // 친구 수 조회
      const { data, error } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'accepted')
      
      if (error) {
        console.error('친구 수 조회 오류:', error)
        return
      }
      
      // 프로필 테이블 업데이트
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ friends: data.length })
        .eq('id', userId)
      
      if (updateError) {
        console.error('프로필 업데이트 오류:', updateError)
      }
    } catch (error) {
      console.error('친구 수 업데이트 오류:', error)
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
  
  const openDeleteDialog = (friendId: string, nickname: string) => {
    setFriendToDelete({ id: friendId, nickname })
    setIsDeleteDialogOpen(true)
  }
  
  const handleRemoveFriend = async (friendId: string) => {
    const supabase = createClientBrowser()
    
    try {
      // 내가 친구를 삭제
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        
      if (error) {
        toast.error('친구 삭제 중 오류가 발생했습니다')
        return
      }
      
      // 상대방의 친구 목록에서도 나를 삭제
      const { error: reverseError } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', userId)
      
      if (reverseError) {
        console.error('상대방 친구 목록 삭제 오류:', reverseError)
      }
      
      // 내 친구 수 업데이트
      await updateFriendCount(userId)
      // 상대방 친구 수 업데이트
      await updateFriendCount(friendId)
      
      toast.success('친구를 성공적으로 삭제했습니다')
      setIsDeleteDialogOpen(false)
      setFriendToDelete(null)
    } catch (error) {
      console.error('Error removing friend:', error)
      toast.error('친구 삭제 중 오류가 발생했습니다')
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
              value={searchNickname}
              onChange={(e) => setSearchNickname(e.target.value)}
              placeholder="친구의 닉네임을 입력하세요"
              className="bg-black/30 border-gray-700"
            />
            <Button
              onClick={handleAddFriend}
              disabled={isSearching}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {isSearching ? '검색 중...' : '추가'}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * 친구의 정확한 닉네임을 입력하세요.
          </p>
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-700"
                      onClick={() => router.push(`/dashboard/chat?friend=${friend.friend_id}`)}
                    >
                      메시지
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openDeleteDialog(friend.friend_id, friend.profile.nickname)}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 친구 삭제 확인 다이얼로그 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-100">친구 삭제 확인</DialogTitle>
            <DialogDescription className="text-gray-400">
              정말 {friendToDelete?.nickname || '이 친구'}님을 친구 목록에서 삭제하시겠습니까?
              삭제 후에는 다시 친구 요청을 보내야 합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-gray-700 text-gray-300"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => friendToDelete && handleRemoveFriend(friendToDelete.id)}
            >
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
