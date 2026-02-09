import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'
import { MarketQueue } from '@/services/market-queue'

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
    
    const queue = MarketQueue.getInstance()
    const scheduler = await MarketScheduler.getInstance()

    await queue.addTask({
      type: 'market-open',
      priority: 3,
      execute: async () => {
        console.log('[market-open] 장 시작 처리 실행')
        await scheduler.setOpeningPrices()
        console.log('[market-open] 장 시작 처리 완료')
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[market-open] Market opening failed:', error)
    return NextResponse.json({ error: 'Market opening failed' }, { status: 500 })
  }
}
