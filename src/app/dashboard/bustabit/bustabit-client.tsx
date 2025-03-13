'use client'

import { useState, useEffect, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { createClientBrowser } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Checkbox } from '@/components/ui/checkbox'

interface BustabitClientProps {
  user: User
  profile: any
  bustabitStats: any
  recentGames: any[]
  userBets: any[]
  gameSettings: {
    house_edge: number
    min_bet: number
    max_bet: number
  }
}

// 게임 상태 타입
type GameState = 'waiting' | 'running' | 'crashed'

export function BustabitClient({ 
  user, 
  profile, 
  bustabitStats,
  recentGames: initialRecentGames,
  userBets: initialUserBets,
  gameSettings
}: BustabitClientProps) {
  // Supabase 클라이언트는 컴포넌트가 마운트된 후에만 초기화
  const [supabase, setSupabase] = useState<any>(null)
  
  useEffect(() => {
    // 브라우저 환경에서만 Supabase 클라이언트 초기화
    setSupabase(createClientBrowser())
  }, [])
  
  // 게임 상태
  const [gameState, setGameState] = useState<GameState>('waiting')
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.00)
  const [currentGameId, setCurrentGameId] = useState<string | null>(null)
  const [recentGames, setRecentGames] = useState<any[]>(initialRecentGames || [])
  const [userBets, setUserBets] = useState<any[]>(initialUserBets || [])
  
  // 베팅 상태
  const [betAmount, setBetAmount] = useState<number>(gameSettings.min_bet)
  const [autoCashout, setAutoCashout] = useState<number>(2.00)
  const [isAutoCashoutEnabled, setIsAutoCashoutEnabled] = useState<boolean>(false)
  const [hasBet, setHasBet] = useState<boolean>(false)
  const [isCashedOut, setIsCashedOut] = useState<boolean>(false)
  const [profit, setProfit] = useState<number | null>(null)
  const [userPoints, setUserPoints] = useState<number>(profile.points || 0)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  
  // 게임 애니메이션 관련
  const animationRef = useRef<number | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)
  
  // 게임 생성 함수
  const createGame = async () => {
    if (!supabase) return
    
    try {
      const { data, error } = await supabase
        .from('bustabit_games')
        .insert({})
        .select()
        .single()
      
      if (error) {
        console.error('Error creating game:', error)
        return null
      }
      
      return data
    } catch (error) {
      console.error('Error creating game:', error)
      return null
    }
  }
  
  // 베팅 함수
  const placeBet = async () => {
    if (!supabase || !currentGameId) return
    
    try {
      setIsLoading(true)
      
      // 잔액 확인
      if (userPoints < betAmount) {
        toast.error('잔액이 부족합니다.')
        return
      }
      
      const { data, error } = await supabase
        .from('bustabit_bets')
        .insert({
          user_id: user.id,
          game_id: currentGameId,
          bet_amount: betAmount,
          auto_cashout_multiplier: autoCashout
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error placing bet:', error)
        toast.error('베팅 중 오류가 발생했습니다.')
        return
      }
      
      // 잔액 업데이트
      const newUserPoints = userPoints - betAmount
      setUserPoints(newUserPoints)
      
      // 프로필 업데이트
      await supabase
        .from('profiles')
        .update({ points: newUserPoints })
        .eq('id', user.id)
      
      setHasBet(true)
      toast.success('베팅이 완료되었습니다.')
    } catch (error) {
      console.error('Error placing bet:', error)
      toast.error('베팅 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }
  
  // 캐시아웃 함수
  const cashout = async () => {
    if (!supabase || !currentGameId) return
    
    // 자동 캐시아웃이 활성화된 경우 수동 캐시아웃 방지
    if (isAutoCashoutEnabled) {
      toast.error('자동 캐시아웃이 활성화되어 있습니다.')
      return
    }
    
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase
        .from('bustabit_bets')
        .update({
          cashout_multiplier: currentMultiplier,
          profit: Math.floor(betAmount * currentMultiplier) - betAmount
        })
        .eq('user_id', user.id)
        .eq('game_id', currentGameId)
        .select()
        .single()
      
      if (error) {
        console.error('Error cashing out:', error)
        toast.error('캐시아웃 중 오류가 발생했습니다.')
        return
      }
      
      // 잔액 업데이트
      const newUserPoints = userPoints + Math.floor(betAmount * currentMultiplier) - betAmount
      setUserPoints(newUserPoints)
      
      // 프로필 업데이트
      await supabase
        .from('profiles')
        .update({ points: newUserPoints })
        .eq('id', user.id)
      
      setIsCashedOut(true)
      setProfit(Math.floor(betAmount * currentMultiplier) - betAmount)
      toast.success(`${Math.floor(betAmount * currentMultiplier) - betAmount > 0 ? '수익' : '손실'}: ${Math.floor(betAmount * currentMultiplier) - betAmount} P`)
    } catch (error) {
      console.error('Error cashing out:', error)
      toast.error('캐시아웃 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }
  
  // 프로필 정보 새로고침
  const refreshProfile = async () => {
    if (!supabase) return
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (error) {
        console.error('Error refreshing profile:', error)
        return
      }
      
      setUserPoints(data.points || 0)
    } catch (error) {
      console.error('Error refreshing profile:', error)
    }
  }
  
  // 게임 상태 업데이트 함수 (애니메이션)
  const updateGameAnimation = (timestamp: number) => {
    if (gameState !== 'running') return
    
    const deltaTime = timestamp - lastUpdateTimeRef.current
    lastUpdateTimeRef.current = timestamp
    
    // 1초당 1.00씩 증가 (서버와 동기화를 위한 근사치)
    const newMultiplier = currentMultiplier + (deltaTime / 1000)
    setCurrentMultiplier(parseFloat(newMultiplier.toFixed(2)))
    
    // 자동 캐시아웃 체크 - 활성화된 경우에만 실행
    if (hasBet && !isCashedOut && isAutoCashoutEnabled && autoCashout > 0 && newMultiplier >= autoCashout) {
      cashout()
    }
    
    animationRef.current = requestAnimationFrame(updateGameAnimation)
  }
  
  // 게임 초기화 함수
  const initializeGame = () => {
    // 이전 게임 상태 초기화
    setGameState('waiting')
    setCurrentMultiplier(1.00)
    setHasBet(false)
    setIsCashedOut(false)
    setProfit(null)
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }
  
  // 실시간 구독 설정
  useEffect(() => {
    // supabase가 초기화되지 않은 경우 리턴
    if (!supabase) return;
    
    // 게임 상태 구독
    const gameChannel = supabase
      .channel('bustabit_game_state')
      .on('broadcast', { event: 'game_state' }, (payload: any) => {
        const { state, gameId, multiplier } = payload.payload
        
        if (state === 'waiting') {
          initializeGame()
          setCurrentGameId(gameId)
        } else if (state === 'running') {
          setGameState('running')
          setCurrentMultiplier(multiplier || 1.00)
          
          // 애니메이션 시작
          if (!animationRef.current) {
            lastUpdateTimeRef.current = performance.now()
            animationRef.current = requestAnimationFrame(updateGameAnimation)
          }
        } else if (state === 'crashed') {
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current)
            animationRef.current = null
          }
          
          setGameState('crashed')
          setCurrentMultiplier(multiplier)
          
          // 최근 게임 목록 업데이트 - 게임이 종료되면 상태 업데이트
          setRecentGames(prevGames => {
            const updatedGames = prevGames.map(game => {
              if (game.id === gameId) {
                return { ...game, crashed_at: new Date(), multiplier }
              }
              return game
            })
            return updatedGames
          })
          
          // 30초 후 초기화 (새 게임 대기)
          setTimeout(() => {
            initializeGame()
          }, 30000)
        }
      })
      .subscribe()
    
    // 최근 게임 구독
    const gamesChannel = supabase
      .channel('bustabit_games')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'bustabit_games' }, 
        (payload: any) => {
          setRecentGames(prevGames => {
            const newGames = [payload.new, ...prevGames]
            return newGames.slice(0, 10) // 최대 10개만 유지
          })
        }
      )
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'bustabit_games' }, 
        (payload: any) => {
          setRecentGames(prevGames => {
            return prevGames.map(game => {
              if (game.id === payload.new.id) {
                return { ...game, ...payload.new }
              }
              return game
            })
          })
        }
      )
      .subscribe()
    
    // 사용자 베팅 구독
    const betsChannel = supabase
      .channel('bustabit_user_bets')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bustabit_bets',
          filter: `user_id=eq.${user.id}`
        }, 
        async (payload: any) => {
          // 베팅 정보에 게임 정보 포함하여 가져오기
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: betWithGame } = await supabase
              .from('bustabit_bets')
              .select(`
                id,
                bet_amount,
                cashout_multiplier,
                auto_cashout_multiplier,
                profit,
                created_at,
                game:bustabit_games(
                  id,
                  multiplier,
                  created_at
                )
              `)
              .eq('id', payload.new.id)
              .single()
            
            if (betWithGame) {
              setUserBets(prevBets => {
                // 이미 있는 베팅이면 업데이트, 없으면 추가
                const existingIndex = prevBets.findIndex(bet => bet.id === betWithGame.id)
                if (existingIndex >= 0) {
                  const updatedBets = [...prevBets]
                  updatedBets[existingIndex] = betWithGame
                  return updatedBets
                } else {
                  return [betWithGame, ...prevBets].slice(0, 10) // 최대 10개만 유지
                }
              })
              
              // 프로필 포인트 업데이트
              refreshProfile()
              
              // 통계 업데이트 (UI에 반영)
              if (payload.eventType === 'UPDATE' && payload.new.profit) {
                const { data: stats } = await supabase
                  .from('bustabit_stats')
                  .select('*')
                  .eq('user_id', user.id)
                  .single()
                
                if (stats) {
                  // 통계 업데이트 로직
                }
              }
            }
          }
        }
      )
      .subscribe()
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      
      supabase.removeChannel(gameChannel)
      supabase.removeChannel(gamesChannel)
      supabase.removeChannel(betsChannel)
    }
  }, [user.id, supabase])
  
  // 베팅 금액 변경 핸들러
  const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (isNaN(value)) return
    
    if (value < gameSettings.min_bet) {
      setBetAmount(gameSettings.min_bet)
    } else if (value > gameSettings.max_bet) {
      setBetAmount(gameSettings.max_bet)
    } else {
      setBetAmount(value)
    }
  }
  
  // 자동 캐시아웃 변경 핸들러
  const handleAutoCashoutChange = (value: number[]) => {
    setAutoCashout(parseFloat(value[0].toFixed(2)))
  }
  
  // 자동 캐시아웃 토글 핸들러
  const handleAutoCashoutToggle = (checked: boolean) => {
    setIsAutoCashoutEnabled(checked)
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
            <h1 className="text-3xl font-bold text-gray-100">Bustabit</h1>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-100">{userPoints.toLocaleString()} P</span>
              <Button variant="ghost" size="icon" onClick={refreshProfile} className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70">
                <ArrowPathIcon className="h-4 w-4 text-zinc-200" />
              </Button>
            </div>
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
                  <CardTitle>게임</CardTitle>
                  <CardDescription>
                    {gameState === 'waiting' && '게임 시작 대기 중...'}
                    {gameState === 'running' && '게임 진행 중...'}
                    {gameState === 'crashed' && '게임 종료!'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center">
                    <div className={`text-7xl font-bold mb-8 ${
                      gameState === 'crashed' ? 'text-red-500' : 
                      isCashedOut ? 'text-green-500' : ''
                    }`}>
                      {currentMultiplier.toFixed(2)}x
                    </div>
                    
                    {gameState === 'running' && hasBet && !isCashedOut && (
                      <Button 
                        className="w-full max-w-md mb-4 bg-green-500 hover:bg-green-600 text-white"
                        onClick={cashout}
                        disabled={isAutoCashoutEnabled}
                      >
                        {isAutoCashoutEnabled ? '자동 캐시아웃 활성화됨' : `캐시아웃 (${(betAmount * currentMultiplier).toFixed(0)} 포인트)`}
                      </Button>
                    )}
                    
                    {isCashedOut && profit !== null && (
                      <div className="text-xl font-medium text-green-500 mb-4">
                        +{profit.toLocaleString()} 포인트
                      </div>
                    )}
                    
                    {gameState === 'waiting' && (
                      <div className="w-full max-w-md">
                        <div className="mb-4">
                          <label className="block text-sm font-medium mb-1">베팅 금액</label>
                          <div className="flex space-x-2">
                            <Input
                              type="number"
                              value={betAmount}
                              onChange={handleBetAmountChange}
                              min={gameSettings.min_bet}
                              max={gameSettings.max_bet}
                              disabled={hasBet}
                              className="bg-black/60 border-gray-700"
                            />
                            <Button 
                              variant="outline" 
                              onClick={() => setBetAmount(Math.max(gameSettings.min_bet, Math.floor(betAmount / 2)))}
                              disabled={hasBet}
                            >
                              1/2
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => setBetAmount(Math.min(gameSettings.max_bet, betAmount * 2))}
                              disabled={hasBet}
                            >
                              2x
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium">
                              자동 캐시아웃: {autoCashout.toFixed(2)}x
                            </label>
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="auto-cashout" 
                                  checked={isAutoCashoutEnabled}
                                  onCheckedChange={handleAutoCashoutToggle}
                                  disabled={hasBet}
                                />
                                <label htmlFor="auto-cashout" className="text-sm cursor-pointer">
                                  {isAutoCashoutEnabled ? '활성화' : '비활성화'}
                                </label>
                              </div>
                            </div>
                          </div>
                          <Slider
                            defaultValue={[2.00]}
                            value={[autoCashout]}
                            min={1.01}
                            max={10.00}
                            step={0.01}
                            onValueChange={handleAutoCashoutChange}
                            disabled={hasBet || !isAutoCashoutEnabled}
                          />
                        </div>
                        
                        <Button 
                          className="w-full" 
                          onClick={placeBet}
                          disabled={hasBet || betAmount > userPoints || !currentGameId}
                        >
                          베팅하기
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-black/60 backdrop-blur-sm border border-gray-800 hover:bg-black/70 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle>최근 게임</CardTitle>
                  <CardDescription>최근 10개 게임 결과</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table className="bg-black/60">
                      <TableHeader>
                        <TableRow className="border-gray-700 bg-black/80">
                          <TableHead>시간</TableHead>
                          <TableHead>배수</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentGames.map((game) => (
                          <TableRow key={game.id} className="border-gray-700 hover:bg-black/60">
                            <TableCell>
                              {formatDistanceToNow(new Date(game.created_at), { addSuffix: true, locale: ko })}
                            </TableCell>
                            <TableCell className={
                              game.crashed_at && new Date(game.crashed_at) < new Date() 
                                ? (game.multiplier < 2 ? 'text-red-500' : 'text-green-500')
                                : 'text-gray-500'
                            }>
                              {game.crashed_at && new Date(game.crashed_at) < new Date() ? 
                                `${game.multiplier.toFixed(2)}x` : 
                                '진행 중'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {recentGames.length === 0 && (
                          <TableRow className="border-gray-700 hover:bg-black/60">
                            <TableCell colSpan={2} className="text-center">게임 기록이 없습니다.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card className="bg-black/60 backdrop-blur-sm border border-gray-800 hover:bg-black/70 transition-colors mb-6">
                <CardHeader className="pb-2">
                  <CardTitle>내 통계</CardTitle>
                  <CardDescription>게임 통계</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">총 베팅:</span>
                      <span>{bustabitStats?.total_bets?.toLocaleString() || 0}회</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">총 베팅 금액:</span>
                      <span>{bustabitStats?.total_wagered?.toLocaleString() || 0} P</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">총 수익:</span>
                      <span className={`${bustabitStats?.total_profit > 0 ? 'text-green-500' : bustabitStats?.total_profit < 0 ? 'text-red-500' : ''}`}>
                        {bustabitStats?.total_profit?.toLocaleString() || 0} P
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">최고 승리:</span>
                      <span className="text-green-500">{bustabitStats?.biggest_win?.toLocaleString() || 0} P</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">최고 배수:</span>
                      <span>{bustabitStats?.biggest_multiplier?.toFixed(2) || '0.00'}x</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-black/60 backdrop-blur-sm border border-gray-800 hover:bg-black/70 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle>내 베팅 기록</CardTitle>
                  <CardDescription>최근 10개 베팅</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table className="bg-black/60">
                      <TableHeader>
                        <TableRow className="border-gray-700 bg-black/80">
                          <TableHead>금액</TableHead>
                          <TableHead>배수</TableHead>
                          <TableHead>수익</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userBets.map((bet) => (
                          <TableRow key={bet.id} className="border-gray-700 hover:bg-black/60">
                            <TableCell>{bet.bet_amount.toLocaleString()} P</TableCell>
                            <TableCell>
                              {bet.cashout_multiplier ? 
                                <span className="text-green-500">{bet.cashout_multiplier.toFixed(2)}x</span> : 
                                <span className="text-red-500">실패</span>
                              }
                            </TableCell>
                            <TableCell className={bet.profit > 0 ? 'text-green-500' : 'text-red-500'}>
                              {bet.profit > 0 ? '+' : ''}{bet.profit?.toLocaleString() || 0} P
                            </TableCell>
                          </TableRow>
                        ))}
                        {userBets.length === 0 && (
                          <TableRow className="border-gray-700 hover:bg-black/60">
                            <TableCell colSpan={3} className="text-center">베팅 기록이 없습니다.</TableCell>
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