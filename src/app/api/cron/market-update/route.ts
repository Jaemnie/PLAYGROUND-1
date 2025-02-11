import { verifySignature } from '@upstash/qstash/dist/verify'
import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'

export const runtime = 'edge'

export async function POST(req: Request) {
  const authorization = req.headers.get('Authorization')
  
  if (!authorization) {
    return new Response('Unauthorized', { status: 401 })
  }

  const isValid = await verifySignature(req)
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 })
  }

  try {
    const scheduler = await MarketScheduler.getInstance()
    await scheduler.updateMarket()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Market update failed:', error)
    return NextResponse.json({ error: 'Market update failed' }, { status: 500 })
  }
} 