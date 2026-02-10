import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { MissionChecker } from '@/services/mission-checker'

/**
 * 미션 진행도 갱신 API
 * 거래, 뉴스 읽기, 메시지 발송 등 이벤트 발생 시 호출
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  try {
    const body = await request.json()
    const { event_type: eventType, value = 1, trade_amount: tradeAmount } = body

    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json({ error: 'event_type 필요' }, { status: 400 })
    }

    const checker = new MissionChecker()
    await checker.updateMissionProgress(user.id, eventType, value, tradeAmount)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[missions/progress] Error:', error)
    return NextResponse.json({ error: '진행도 갱신 실패' }, { status: 500 })
  }
}
