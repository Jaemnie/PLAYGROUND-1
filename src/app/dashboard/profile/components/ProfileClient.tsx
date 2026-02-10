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
  const [isCheckingNickname, setIsCheckingNickname] = useState(false)
  const [nicknameError, setNicknameError] = useState('')
  const [isNicknameAvailable, setIsNicknameAvailable] = useState(false)

  // 닉네임 유효성 검사 및 중복 확인
  const checkNickname = async (value: string) => {
    // 입력값이 없거나 기존 닉네임과 동일한 경우 검사 불필요
    if (!value.trim() || value.trim() === profile.nickname) {
      setNicknameError('')
      setIsNicknameAvailable(false)
      return
    }

    // 닉네임 길이 검사
    if (value.trim().length < 2) {
      setNicknameError('닉네임은 최소 2자 이상이어야 합니다')
      setIsNicknameAvailable(false)
      return
    }

    if (value.trim().length > 20) {
      setNicknameError('닉네임은 최대 20자까지 가능합니다')
      setIsNicknameAvailable(false)
      return
    }

    setIsCheckingNickname(true)
    setNicknameError('')
    
    try {
      const supabase = createClientBrowser()
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('nickname', value.trim())
        .neq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('닉네임 중복 검사 오류:', error)
        setNicknameError('닉네임 확인 중 오류가 발생했습니다')
        setIsNicknameAvailable(false)
      } else if (data) {
        setNicknameError('이미 사용 중인 닉네임입니다')
        setIsNicknameAvailable(false)
      } else {
        setNicknameError('')
        setIsNicknameAvailable(true)
      }
    } catch (error) {
      console.error('닉네임 확인 중 예외 발생:', error)
      setNicknameError('닉네임 확인 중 오류가 발생했습니다')
      setIsNicknameAvailable(false)
    } finally {
      setIsCheckingNickname(false)
    }
  }

  // 닉네임 변경 시 유효성 검사
  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNickname(value)
    checkNickname(value)
  }

  const handleUpdateNickname = async () => {
    if (!nickname.trim()) {
      toast.error('닉네임을 입력해주세요')
      return
    }

    // 기존 닉네임과 동일한 경우 변경 불필요
    if (nickname.trim() === profile.nickname) {
      setIsEditing(false)
      return
    }

    // 닉네임 유효성 검사
    if (nickname.trim().length < 2) {
      toast.error('닉네임은 최소 2자 이상이어야 합니다')
      return
    }

    if (nickname.trim().length > 20) {
      toast.error('닉네임은 최대 20자까지 가능합니다')
      return
    }

    if (nicknameError) {
      toast.error(nicknameError)
      return
    }

    setIsLoading(true)
    const supabase = createClientBrowser()

    try {
      // 닉네임 중복 검사
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('nickname', nickname.trim())
        .neq('id', user.id)
        .maybeSingle()

      if (checkError) {
        console.error('닉네임 중복 검사 오류:', checkError)
        toast.error('닉네임 중복 검사 중 오류가 발생했습니다')
        setIsLoading(false)
        return
      }

      if (existingUser) {
        toast.error('이미 사용 중인 닉네임입니다. 다른 닉네임을 선택해주세요.')
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ nickname: nickname.trim() })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      // 프로필 상태 업데이트
      setProfile(data)
      toast.success('닉네임이 변경되었습니다')
      setIsEditing(false)
      setIsNicknameAvailable(false)
    } catch (error) {
      console.error('Error updating nickname:', error)
      toast.error('닉네임 변경에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>

      {/* 컴팩트 헤더 */}
      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">
              STACKS
            </p>
            <h1 className="text-2xl font-bold text-gray-100">
              내 프로필
            </h1>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-6">
            {/* 기본 프로필 정보 */}
            <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50">
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
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={nickname}
                          onChange={handleNicknameChange}
                          className={`bg-black/30 ${
                            nicknameError 
                              ? 'border-red-500' 
                              : isNicknameAvailable && nickname.trim() !== profile.nickname
                                ? 'border-green-500' 
                                : 'border-gray-700'
                          }`}
                          placeholder="2~20자 이내로 입력하세요"
                        />
                        <Button
                          onClick={handleUpdateNickname}
                          disabled={isLoading || isCheckingNickname || !!nicknameError || (!isNicknameAvailable && nickname.trim() !== profile.nickname)}
                          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700"
                        >
                          {isLoading ? '저장 중...' : '저장'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false)
                            setNickname(profile.nickname)
                            setNicknameError('')
                            setIsNicknameAvailable(false)
                          }}
                          className="border-gray-700"
                        >
                          취소
                        </Button>
                      </div>
                      
                      {/* 닉네임 유효성 검사 결과 표시 */}
                      {isCheckingNickname && (
                        <p className="text-xs text-yellow-400">닉네임 확인 중...</p>
                      )}
                      
                      {nicknameError && (
                        <p className="text-xs text-red-500">{nicknameError}</p>
                      )}
                      
                      {isNicknameAvailable && nickname.trim() !== profile.nickname && !nicknameError && !isCheckingNickname && (
                        <p className="text-xs text-green-500">사용 가능한 닉네임입니다</p>
                      )}
                      
                      {!nickname.trim() && (
                        <p className="text-xs text-gray-500">닉네임을 입력해주세요</p>
                      )}
                      
                      {nickname.trim() === profile.nickname && (
                        <p className="text-xs text-gray-500">현재 사용 중인 닉네임입니다</p>
                      )}
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
      </section>
    </div>
  )
} 