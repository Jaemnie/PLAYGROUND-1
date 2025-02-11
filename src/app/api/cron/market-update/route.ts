import { verifySignature } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'

export const runtime = 'edge'

export async function POST(req: Request) {
  const authorization = req.headers.get('Authorization')
  
  if (!authorization) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const isValid = await verifySignature({
      signature: authorization,
      body: await req.text(),
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!
    })

    if (!isValid) {
      return new Response('Invalid signature', { status: 401 })
    }

    const scheduler = await MarketScheduler.getInstance()
    await scheduler.updateMarket()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Market update failed:', error)
    return NextResponse.json({ error: 'Market update failed' }, { status: 500 })
  }
} 