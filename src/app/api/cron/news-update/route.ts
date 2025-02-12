import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { MarketScheduler } from '@/services/market-scheduler'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!
})

let schedulerInstance: MarketScheduler | null = null

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
    
    // 인스턴스가 없을 때만 초기화
    if (!schedulerInstance) {
      console.log('마켓 스케줄러 인스턴스 생성')
      schedulerInstance = await MarketScheduler.getInstance()
    }
    
    if (!schedulerInstance.isMarketOpen()) {
      console.log('장 운영 시간이 아닙니다. 요청을 거부합니다.')
      return NextResponse.json({ 
        success: false, 
        message: '장 운영 시간이 아닙니다.' 
      }, { status: 400 })
    }

    await schedulerInstance.updateNews()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('News update failed:', error)
    return NextResponse.json({ error: 'News update failed' }, { status: 500 })
  }
} 