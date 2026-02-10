import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { SeasonManager } from '@/services/season-manager'

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
    const manager = new SeasonManager()
    await manager.tick()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[season-tick] Error:', error)
    return NextResponse.json({ error: 'Season tick failed' }, { status: 500 })
  }
}
