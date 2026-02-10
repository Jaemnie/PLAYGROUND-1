import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { MissionChecker } from '@/services/mission-checker'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const checker = new MissionChecker()
  const result = await checker.checkIn(user.id)

  return NextResponse.json(result)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  // 최근 출석 기록 7일 조회
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: checkIns } = await supabase
    .from('daily_check_ins')
    .select('*')
    .eq('user_id', user.id)
    .gte('checked_in_at', sevenDaysAgo.toISOString().split('T')[0])
    .order('checked_in_at', { ascending: false })

  return NextResponse.json({ checkIns: checkIns || [] })
}
