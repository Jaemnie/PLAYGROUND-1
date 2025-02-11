import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!
})

export async function POST(req: Request) {
  const signature = req.headers.get('upstash-signature')
  if (!signature) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const body = await req.text()

  try {
    const isValid = await receiver.verify({ signature, body })
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 })
    }
    
    const scheduler = await MarketScheduler.getInstance()
    await scheduler.setOpeningPrices()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Market opening failed:', error)
    return NextResponse.json({ error: 'Market opening failed' }, { status: 500 })
  }
} 