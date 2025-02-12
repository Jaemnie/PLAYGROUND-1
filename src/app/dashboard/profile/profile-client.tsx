'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DashboardBackButton from '@/components/DashboardBackButton'
import { User } from '@supabase/supabase-js'
import { createClientBrowser } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  UserCircle,
  Settings
} from 'lucide-react'

interface ProfileClientProps {
  user: User
  profile: {
    nickname: string
    points: number
    created_at: string
  }
}

export function ProfileClient({ user, profile: initialProfile }: ProfileClientProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState(initialProfile)
  const [nickname, setNickname] = useState(profile.nickname)

  const handleUpdateNickname = async () => {
    if (!nickname.trim()) {
      toast.error('닉네임을 입력해주세요')
      return
    }

    setIsLoading(true)
    const supabase = createClientBrowser()

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ nickname })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      // 프로필 상태 업데이트
      setProfile(data)
      toast.success('닉네임이 변경되었습니다')
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating nickname:', error)
      toast.error('닉네임 변경에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">내 프로필</h1>
        
        <div className="grid grid-cols-1 gap-6">
          {/* 기본 프로필 정보 */}
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCircle className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-bold text-gray-100">프로필 정보</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-2">이메일</p>
                  <p className="text-gray-200">{user.email}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-400 mb-2">닉네임</p>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="bg-black/30 border-gray-700"
                      />
                      <Button
                        onClick={handleUpdateNickname}
                        disabled={isLoading}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        저장
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false)
                          setNickname(profile.nickname)
                        }}
                        className="border-gray-700"
                      >
                        취소
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-gray-200">{profile.nickname}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="text-blue-400 hover:text-blue-500"
                      >
                        변경
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-gray-400 mb-2">보유 포인트</p>
                  <p className="text-gray-200">
                    {profile.points?.toLocaleString() || 0} P
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-400 mb-2">가입일</p>
                  <p className="text-gray-200">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 