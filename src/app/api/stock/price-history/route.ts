import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/upstash-client'
import { CACHE_TTL } from '@/constants/cache'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker')
    const timeframe = searchParams.get('timeframe')

    if (!ticker || !timeframe) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // Redis 캐시 키 생성
    const cacheKey = `price_history:${ticker}:${timeframe}`
    
    // 캐시된 데이터 확인
    const cachedData = await redis.get(cacheKey)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    const supabase = await createClient()
    
    const { data: company } = await supabase
      .from('companies')
      .select('id, current_price, last_closing_price')
      .eq('ticker', ticker)
      .single()

    if (!company) {
      return NextResponse.json(
        { error: '회사를 찾을 수 없습니다.' }, 
        { status: 404 }
      )
    }

    // 페이징 제한을 5000으로 증가
    const { data: priceUpdates, error } = await supabase
      .from('price_updates')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: true })
      .limit(5000)

    if (error) throw error

    if (!priceUpdates?.length) {
      return NextResponse.json({ 
        candleData: [],
        currentPrice: company.current_price,
        lastClosingPrice: company.last_closing_price
      })
    }

    // 전체 데이터의 시작과 끝 시간 구하기
    const firstUpdate = new Date(priceUpdates[0].created_at)
    const lastUpdate = new Date(priceUpdates[priceUpdates.length - 1].created_at)

    // 시간 간격(분) 계산 함수
    function getTimeIntervalMinutes(timeframe: string): number {
      switch (timeframe) {
        case '1M': return 1
        case '5M': return 5
        case '30M': return 30
        case '1H': return 60
        case '1D': return 24 * 60
        case '7D': return 7 * 24 * 60
        default: return 1
      }
    }

    // 전체 시간대 배열 생성 함수
    function generateTimeSlots(startTime: Date, endTime: Date, intervalMinutes: number): Date[] {
      const slots: Date[] = []
      let currentTime = new Date(startTime)

      while (currentTime <= endTime) {
        slots.push(new Date(currentTime))
        currentTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000)
      }

      return slots
    }

    // OHLC 데이터 생성
    const intervalMinutes = getTimeIntervalMinutes(timeframe)
    const timeSlots = generateTimeSlots(firstUpdate, lastUpdate, intervalMinutes)

    // 거래 시간 확인 함수 추가
    function isWithinTradingHours(date: Date): boolean {
      const hour = date.getHours()
      return hour >= 9 && hour < 24
    }

    const ohlcData = new Map()
    let lastValidPrice: number | null = priceUpdates[0].new_price
    let lastValidTime: number | null = null

    timeSlots.forEach(timeSlot => {
      const key = timeSlot.getTime()
      
      // 거래 시간이 아니면 건너뛰기
      if (!isWithinTradingHours(timeSlot)) {
        return
      }

      const relevantUpdates = priceUpdates?.filter(update => {
        const updateTime = new Date(update.created_at)
        const slotEnd = new Date(timeSlot.getTime() + intervalMinutes * 60 * 1000)
        return updateTime >= timeSlot && updateTime < slotEnd
      })

      if (relevantUpdates?.length > 0) {
        const prices = relevantUpdates.map(u => u.new_price)
        lastValidPrice = prices[prices.length - 1]
        lastValidTime = key
        
        ohlcData.set(lastValidTime, {
          x: lastValidTime,
          y: [
            prices[0],
            Math.max(...prices),
            Math.min(...prices),
            lastValidPrice
          ]
        })
      }
    })

    // 연속된 데이터 배열로 변환
    const candleData = Array.from(ohlcData.values())

    const response = { 
      candleData,
      currentPrice: company.current_price,
      lastClosingPrice: company.last_closing_price
    }

    // 결과를 Redis에 캐시 (1분)
    await redis.set(cacheKey, response, { ex: CACHE_TTL.PRICE })

    return NextResponse.json(response)
  } catch (error) {
    console.error('가격 기록 조회 오류:', error)
    return NextResponse.json(
      { error: '가격 기록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 