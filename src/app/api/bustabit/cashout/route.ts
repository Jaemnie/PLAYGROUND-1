import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, gameId, cashoutMultiplier } = await request.json()
    
    if (!userId || !gameId || !cashoutMultiplier) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const supabase = await createClient()
    
    // 베팅 정보 조회
    const { data: bet, error: betError } = await supabase
      .from('bustabit_bets')
      .select('id, bet_amount, cashout_multiplier')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .single()
    
    if (betError || !bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 })
    }
    
    // 이미 캐시아웃한 경우
    if (bet.cashout_multiplier) {
      return NextResponse.json({ error: 'Already cashed out' }, { status: 400 })
    }
    
    // 게임 정보 조회
    const { data: game, error: gameError } = await supabase
      .from('bustabit_games')
      .select('multiplier')
      .eq('id', gameId)
      .single()
    
    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }
    
    // 캐시아웃 배수가 게임 배수보다 큰 경우 (부정 시도)
    if (cashoutMultiplier > game.multiplier) {
      return NextResponse.json({ 
        error: 'Invalid cashout multiplier' 
      }, { status: 400 })
    }
    
    // 이익 계산
    const winAmount = Math.floor(bet.bet_amount * cashoutMultiplier)
    const profitAmount = winAmount - bet.bet_amount
    
    // 베팅 업데이트
    const { error: updateError } = await supabase
      .from('bustabit_bets')
      .update({
        cashout_multiplier: cashoutMultiplier,
        profit: profitAmount
      })
      .eq('id', bet.id)
    
    if (updateError) {
      console.error('Cashout update error:', updateError)
      return NextResponse.json({ error: 'Failed to cashout' }, { status: 500 })
    }
    
    // 포인트 지급 (트리거에서 처리되므로 여기서는 생략)
    
    return NextResponse.json({ 
      success: true, 
      cashout: {
        multiplier: cashoutMultiplier,
        winAmount: winAmount,
        profit: profitAmount
      }
    })
  } catch (error) {
    console.error('Error cashing out:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 