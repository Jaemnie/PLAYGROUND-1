import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, gameId, betAmount, autoCashoutMultiplier } = await request.json()
    
    if (!userId || !gameId || !betAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const supabase = await createClient()
    
    // 게임 설정 조회
    const { data: settings } = await supabase
      .from('bustabit_settings')
      .select('min_bet, max_bet')
      .single()
    
    // 베팅 금액 검증
    if (betAmount < (settings?.min_bet || 10)) {
      return NextResponse.json({ 
        error: `Minimum bet amount is ${settings?.min_bet || 10} points` 
      }, { status: 400 })
    }
    
    if (betAmount > (settings?.max_bet || 100000)) {
      return NextResponse.json({ 
        error: `Maximum bet amount is ${settings?.max_bet || 100000} points` 
      }, { status: 400 })
    }
    
    // 사용자 포인트 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single()
    
    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }
    
    // 포인트 부족 검증
    if (profile.points < betAmount) {
      return NextResponse.json({ error: 'Insufficient points' }, { status: 400 })
    }
    
    // 게임 존재 여부 확인
    const { data: game, error: gameError } = await supabase
      .from('bustabit_games')
      .select('id')
      .eq('id', gameId)
      .single()
    
    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }
    
    // 트랜잭션 시작
    // 베팅 생성
    const { data: bet, error: betError } = await supabase
      .from('bustabit_bets')
      .insert({
        user_id: userId,
        game_id: gameId,
        bet_amount: betAmount,
        auto_cashout_multiplier: autoCashoutMultiplier || null
      })
      .select('id')
      .single()
    
    if (betError) {
      console.error('Bet creation error:', betError)
      return NextResponse.json({ error: 'Failed to place bet' }, { status: 500 })
    }
    
    // 포인트 차감 (트리거에서 처리되므로 여기서는 생략)
    
    return NextResponse.json({ 
      success: true, 
      bet: {
        id: bet.id,
        betAmount: betAmount
      }
    })
  } catch (error) {
    console.error('Error placing bet:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 