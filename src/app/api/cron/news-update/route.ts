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
    console.error('[news-update] Missing upstash-signature header')
    return new Response('Unauthorized', { status: 401 })
  }
  
  const body = await req.text()

  try {
    const isValid = await receiver.verify({ signature, body })
    if (!isValid) {
      console.error('[news-update] Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }
    
    const scheduler = await MarketScheduler.getInstance()
    
    if (!scheduler.isMarketOpen()) {
      console.log('[news-update] 장 운영 시간이 아닙니다.')
      return NextResponse.json({ success: true, skipped: true, reason: 'market_closed' })
    }

    // MarketQueue를 거치지 않고 직접 실행
    console.log('[news-update] 뉴스 업데이트 직접 실행 시작')
    await scheduler.updateNews()
    console.log('[news-update] 뉴스 업데이트 직접 실행 완료')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[news-update] News update failed:', error)
    return NextResponse.json({ error: 'News update failed' }, { status: 500 })
  }
}
