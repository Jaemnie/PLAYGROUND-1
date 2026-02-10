import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { MissionChecker } from '@/services/mission-checker'

// 사용자 활성 미션 조회
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { data: missions } = await supabase
    .from('user_missions')
    .select('*, mission_template:mission_templates(*)')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('assigned_at', { ascending: false })

  return NextResponse.json({ missions: missions || [] })
}

// 미션 보상 수령
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await request.json()
  const { mission_id } = body

  if (!mission_id) {
    return NextResponse.json({ error: 'mission_id 필요' }, { status: 400 })
  }

  const checker = new MissionChecker()
  const result = await checker.claimReward(user.id, mission_id)

  if (!result) {
    return NextResponse.json({ error: '보상 수령 실패' }, { status: 400 })
  }

  return NextResponse.json({ success: true, ...result })
}
