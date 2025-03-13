import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// 게임 해시 생성 함수
function generateGameHash(): string {
  return crypto.randomBytes(16).toString('hex')
}

// 게임 배수 계산 함수
function calculateMultiplier(hash: string): number {
  // 해시를 숫자로 변환
  const hmac = crypto.createHmac('sha256', process.env.BUSTABIT_SECRET || 'default-secret')
  hmac.update(hash)
  const seed = parseInt(hmac.digest('hex').slice(0, 8), 16)
  
  // 0에서 1 사이의 난수 생성
  const r = seed / 0xffffffff
  
  // 하우스 엣지 적용 (1%)
  if (r < 0.01) return 1.00 // 1% 확률로 1.00에서 크래시
  
  // 배수 계산 (99 / r 공식 사용)
  return Math.floor(99 / r) / 100
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // 게임 설정 조회
    const { data: settings } = await supabase
      .from('bustabit_settings')
      .select('*')
      .single()
    
    // 게임 해시 생성
    const gameHash = generateGameHash()
    
    // 배수 계산
    const multiplier = calculateMultiplier(gameHash)
    
    // 게임 생성
    const { data: game, error } = await supabase
      .from('bustabit_games')
      .insert({
        game_hash: gameHash,
        multiplier: multiplier,
        crashed_at: new Date()
      })
      .select('id, game_hash, multiplier')
      .single()
    
    if (error) {
      console.error('Game creation error:', error)
      return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      game: {
        id: game.id,
        multiplier: game.multiplier
      }
    })
  } catch (error) {
    console.error('Error creating game:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 