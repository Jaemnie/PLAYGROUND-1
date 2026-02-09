import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'
import { MarketQueue } from '@/services/market-queue'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!
})

export async function POST(req: Request) {
  const debugSteps: string[] = []

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
    debugSteps.push('1_signature_ok')

    const scheduler = await MarketScheduler.getInstance()
    debugSteps.push('2_scheduler_ready')

    const now = new Date()
    const utcHour = now.getUTCHours()
    const koreaHour = (utcHour + 9) % 24
    const marketOpen = scheduler.isMarketOpen()
    debugSteps.push(`3_time_utc${utcHour}_kst${koreaHour}_open${marketOpen}`)

    if (!marketOpen) {
      return NextResponse.json({ 
        success: true, skipped: true, reason: 'market_closed', 
        debug: debugSteps 
      })
    }

    const queue = MarketQueue.getInstance()
    debugSteps.push('4_queue_ready')

    await queue.addTask({
      type: 'news-update',
      priority: 2,
      execute: async () => {
        console.log('[news-update] 뉴스 업데이트 태스크 실행 시작')
        await scheduler.updateNews()
        console.log('[news-update] 뉴스 업데이트 태스크 실행 완료')
      }
    })
    debugSteps.push('5_task_completed')

    return NextResponse.json({ success: true, debug: debugSteps })
  } catch (error) {
    debugSteps.push(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    console.error('[news-update] News update failed:', error, 'steps:', debugSteps)
    return NextResponse.json({ error: 'News update failed', debug: debugSteps }, { status: 500 })
  }
}
