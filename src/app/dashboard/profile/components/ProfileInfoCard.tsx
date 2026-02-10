'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserCircle } from 'lucide-react'
import { createClientBrowser } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface ProfileInfoCardProps {
  email: string
  nickname: string
  createdAt: string
  userId: string
  onNicknameUpdate: (newNickname: string) => void
}

export function ProfileInfoCard({
  email,
  nickname: initialNickname,
  createdAt,
  userId,
  onNicknameUpdate,
}: ProfileInfoCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [nickname, setNickname] = useState(initialNickname)
  const [isCheckingNickname, setIsCheckingNickname] = useState(false)
  const [nicknameError, setNicknameError] = useState('')
  const [isNicknameAvailable, setIsNicknameAvailable] = useState(false)

  const checkNickname = async (value: string) => {
    if (!value.trim() || value.trim() === initialNickname) {
      setNicknameError('')
      setIsNicknameAvailable(false)
      return
    }
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
        .neq('id', userId)
        .maybeSingle()

      if (error) {
        setNicknameError('닉네임 확인 중 오류가 발생했습니다')
        setIsNicknameAvailable(false)
      } else if (data) {
        setNicknameError('이미 사용 중인 닉네임입니다')
        setIsNicknameAvailable(false)
      } else {
        setNicknameError('')
        setIsNicknameAvailable(true)
      }
    } catch {
      setNicknameError('닉네임 확인 중 오류가 발생했습니다')
      setIsNicknameAvailable(false)
    } finally {
      setIsCheckingNickname(false)
    }
  }

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
    if (nickname.trim() === initialNickname) {
      setIsEditing(false)
      return
    }
    if (nickname.trim().length < 2 || nickname.trim().length > 20) {
      toast.error('닉네임은 2~20자 이내로 입력해주세요')
      return
    }
    if (nicknameError) {
      toast.error(nicknameError)
      return
    }

    setIsLoading(true)
    const supabase = createClientBrowser()

    try {
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('nickname', nickname.trim())
        .neq('id', userId)
        .maybeSingle()

      if (checkError || existingUser) {
        toast.error('이미 사용 중인 닉네임입니다')
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ nickname: nickname.trim() })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      onNicknameUpdate(data.nickname)
      toast.success('닉네임이 변경되었습니다')
      setIsEditing(false)
      setIsNicknameAvailable(false)
    } catch {
      toast.error('닉네임 변경에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
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
            <p className="text-gray-200">{email}</p>
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
                        : isNicknameAvailable && nickname.trim() !== initialNickname
                          ? 'border-green-500'
                          : 'border-gray-700'
                    }`}
                    placeholder="2~20자 이내로 입력하세요"
                  />
                  <Button
                    onClick={handleUpdateNickname}
                    disabled={
                      isLoading ||
                      isCheckingNickname ||
                      !!nicknameError ||
                      (!isNicknameAvailable && nickname.trim() !== initialNickname)
                    }
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700"
                  >
                    {isLoading ? '저장 중...' : '저장'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setNickname(initialNickname)
                      setNicknameError('')
                      setIsNicknameAvailable(false)
                    }}
                    className="border-gray-700"
                  >
                    취소
                  </Button>
                </div>
                {isCheckingNickname && <p className="text-xs text-yellow-400">닉네임 확인 중...</p>}
                {nicknameError && <p className="text-xs text-red-500">{nicknameError}</p>}
                {isNicknameAvailable && nickname.trim() !== initialNickname && !nicknameError && !isCheckingNickname && (
                  <p className="text-xs text-green-500">사용 가능한 닉네임입니다</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-gray-200">{nickname}</p>
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
            <p className="text-sm text-gray-400 mb-2">가입일</p>
            <p className="text-gray-200">{new Date(createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
