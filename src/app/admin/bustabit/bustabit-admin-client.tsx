'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ArrowLeftIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

// 베팅 데이터 타입 정의
interface BetStat {
  id: string;
  bet_amount: number;
  cashout_multiplier: number | null;
  profit: number | null;
  user_id: string;
  created_at: string;
  user?: {
    nickname: string;
  };
}

interface BustabitAdminClientProps {
  user: User
  schedulerStatus: string
  gameStats: any[]
  betStats: BetStat[]
  gameSettings: {
    house_edge: number
    min_bet: number
    max_bet: number
  }
}

export function BustabitAdminClient({ 
  user, 
  schedulerStatus: initialStatus,
  gameStats,
  betStats,
  gameSettings
}: BustabitAdminClientProps) {
  const [schedulerStatus, setSchedulerStatus] = useState<string>(initialStatus)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [minBet, setMinBet] = useState<number>(gameSettings.min_bet)
  const [maxBet, setMaxBet] = useState<number>(gameSettings.max_bet)
  const [houseEdge, setHouseEdge] = useState<number>(gameSettings.house_edge)
  
  // 컴포넌트 마운트 시 스케줄러 상태 확인
  useEffect(() => {
    const checkSchedulerStatus = async () => {
      try {
        const response = await fetch('/api/bustabit/scheduler')
        if (response.ok) {
          const data = await response.json()
          setSchedulerStatus(data.status)
        }
      } catch (error) {
        console.error('Error checking scheduler status:', error)
      }
    }
    
    checkSchedulerStatus()
  }, [])
  
  // 컴포넌트 마운트 시 베팅 데이터 로깅
  useEffect(() => {
    console.log('베팅 통계 데이터:', betStats)
  }, [betStats])
  
  // 스케줄러 제어 함수
  const controlScheduler = async (action: 'start' | 'stop') => {
    try {
      setIsLoading(true)
      
      // 스케줄러 상태 업데이트
      const response = await fetch('/api/bustabit/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || '스케줄러 제어 중 오류가 발생했습니다.')
        return
      }
      
      const data = await response.json()
      toast.success(data.message)
      
      // 상태 업데이트
      setSchedulerStatus(action === 'start' ? 'running' : 'stopped')
      
      // 스케줄러 상태 다시 확인
      setTimeout(async () => {
        try {
          const statusResponse = await fetch('/api/bustabit/scheduler')
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            setSchedulerStatus(statusData.status)
          }
        } catch (error) {
          console.error('Error checking scheduler status:', error)
        }
      }, 1000)
    } catch (error) {
      console.error('Error controlling scheduler:', error)
      toast.error('스케줄러 제어 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }
  
  // 게임 설정 업데이트 함수
  const updateGameSettings = async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/bustabit/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          min_bet: minBet,
          max_bet: maxBet,
          house_edge: houseEdge
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || '설정 업데이트 중 오류가 발생했습니다.')
        return
      }
      
      toast.success('게임 설정이 업데이트되었습니다.')
    } catch (error) {
      console.error('Error updating game settings:', error)
      toast.error('설정 업데이트 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-black">
      <div className="fixed top-4 left-4 z-50">
        <Link href="/dashboard">
          <Button variant="ghost" className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70">
            <ArrowLeftIcon className="h-4 w-4 text-zinc-200" />
          </Button>
        </Link>
      </div>
      
      {/* 헤더 섹션 */}
      <section className="relative pt-32 pb-20 px-4 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative container mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-100">Bustabit 관리자</h1>
          </div>
        </div>
      </section>
      
      {/* 컨텐츠 섹션 */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-black/60 backdrop-blur-sm border border-gray-800 hover:bg-black/70 transition-colors mb-6">
                <CardHeader className="pb-2">
                  <CardTitle>스케줄러 제어</CardTitle>
                  <CardDescription>
                    현재 상태: {schedulerStatus === 'running' ? '실행 중' : '중지됨'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-4">
                    <Button 
                      onClick={() => controlScheduler('start')}
                      disabled={isLoading || schedulerStatus === 'running'}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      시작
                    </Button>
                    <Button 
                      onClick={() => controlScheduler('stop')}
                      disabled={isLoading || schedulerStatus === 'stopped'}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      <StopIcon className="h-4 w-4 mr-2" />
                      중지
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-black/60 backdrop-blur-sm border border-gray-800 hover:bg-black/70 transition-colors mb-6">
                <CardHeader className="pb-2">
                  <CardTitle>게임 설정</CardTitle>
                  <CardDescription>
                    게임 설정을 변경합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">최소 베팅 금액</label>
                      <Input
                        type="number"
                        value={minBet}
                        onChange={(e) => setMinBet(parseInt(e.target.value))}
                        min={1}
                        className="bg-black/60 border-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">최대 베팅 금액</label>
                      <Input
                        type="number"
                        value={maxBet}
                        onChange={(e) => setMaxBet(parseInt(e.target.value))}
                        min={1000}
                        className="bg-black/60 border-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">하우스 엣지 (%)</label>
                      <Input
                        type="number"
                        value={houseEdge}
                        onChange={(e) => setHouseEdge(parseFloat(e.target.value))}
                        min={0.1}
                        max={10}
                        step={0.1}
                        className="bg-black/60 border-gray-700"
                      />
                    </div>
                    <Button
                      onClick={updateGameSettings}
                      disabled={isLoading}
                    >
                      설정 저장
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-black/60 backdrop-blur-sm border border-gray-800 hover:bg-black/70 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle>최근 게임</CardTitle>
                  <CardDescription>최근 20개 게임 결과</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table className="bg-black/60">
                      <TableHeader>
                        <TableRow className="border-gray-700 bg-black/80">
                          <TableHead>ID</TableHead>
                          <TableHead>시간</TableHead>
                          <TableHead>배수</TableHead>
                          <TableHead>해시</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(gameStats || []).map((game) => (
                          <TableRow key={game.id} className="border-gray-700 hover:bg-black/60">
                            <TableCell className="font-mono text-xs">{game.id.substring(0, 8)}...</TableCell>
                            <TableCell>
                              {formatDistanceToNow(new Date(game.created_at), { addSuffix: true, locale: ko })}
                            </TableCell>
                            <TableCell className={game.multiplier < 2 ? 'text-red-500' : 'text-green-500'}>
                              {game.multiplier.toFixed(2)}x
                            </TableCell>
                            <TableCell className="font-mono text-xs">{game.game_hash.substring(0, 8)}...</TableCell>
                          </TableRow>
                        ))}
                        {(!gameStats || gameStats.length === 0) && (
                          <TableRow className="border-gray-700 hover:bg-black/60">
                            <TableCell colSpan={4} className="text-center">게임 기록이 없습니다.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card className="bg-black/60 backdrop-blur-sm border border-gray-800 hover:bg-black/70 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle>최근 베팅</CardTitle>
                  <CardDescription>최근 20개 베팅 기록</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table className="bg-black/60">
                      <TableHeader>
                        <TableRow className="border-gray-700 bg-black/80">
                          <TableHead>사용자</TableHead>
                          <TableHead>금액</TableHead>
                          <TableHead>배수</TableHead>
                          <TableHead>수익</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(betStats || []).map((bet) => (
                          <TableRow key={bet.id} className="border-gray-700 hover:bg-black/60">
                            <TableCell>{bet.user?.nickname || (bet.user_id && bet.user_id.substring(0, 8)) || '알 수 없음'}</TableCell>
                            <TableCell>{(bet.bet_amount || 0).toLocaleString()} P</TableCell>
                            <TableCell>
                              {bet.cashout_multiplier ? 
                                <span className="text-green-500">{bet.cashout_multiplier.toFixed(2)}x</span> : 
                                <span className="text-red-500">실패</span>
                              }
                            </TableCell>
                            <TableCell className={(bet.profit || 0) > 0 ? 'text-green-500' : 'text-red-500'}>
                              {(bet.profit || 0) > 0 ? '+' : ''}{(bet.profit || 0).toLocaleString()} P
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!betStats || betStats.length === 0) && (
                          <TableRow className="border-gray-700 hover:bg-black/60">
                            <TableCell colSpan={4} className="text-center">베팅 기록이 없습니다.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
} 