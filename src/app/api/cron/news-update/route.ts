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
    console.error('Missing upstash-signature header')
    return new Response('Unauthorized', { status: 401 })
  }
  
  const body = await req.text()

  try {
    const isValid = await receiver.verify({ signature, body })
    if (!isValid) {
      console.error('Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }
    
    const queue = MarketQueue.getInstance()
    const scheduler = await MarketScheduler.getInstance()
    
    await queue.addTask({
      type: 'news-update',
      priority: 2, // 마켓 업데이트보다 높은 우선순위
      execute: async () => {
        if (!scheduler.isMarketOpen()) {
          console.log('장 운영 시간이 아닙니다.')
          return
        }
        await scheduler.updateNews()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('News update failed:', error)
    return NextResponse.json({ error: 'News update failed' }, { status: 500 })
  }
} 