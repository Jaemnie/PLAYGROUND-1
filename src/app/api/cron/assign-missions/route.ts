import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { MissionChecker } from '@/services/mission-checker'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(req: Request) {
  const signature = req.headers.get('upstash-signature')
  if (!signature) return new Response('Unauthorized', { status: 401 })

  const body = await req.text()

  try {
    const isValid = await receiver.verify({ signature, body })
    if (!isValid) return new Response('Invalid signature', { status: 401 })
  } catch {
    return new Response('Invalid signature', { status: 401 })
  }

  try {
    const checker = new MissionChecker()

    // 일일 미션 배정
    await checker.assignDailyMissions()

    // 월요일이면 주간 미션도 배정
    const today = new Date()
    if (today.getDay() === 1) {
      await checker.assignWeeklyMissions()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[assign-missions] Error:', error)
    return NextResponse.json({ error: 'Failed to assign missions' }, { status: 500 })
  }
}
