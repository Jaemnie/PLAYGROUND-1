import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    const now = new Date()
    const startTime = new Date()

    switch (timeframe) {
      case '1M':
        startTime.setMinutes(now.getMinutes() - 60)
        break
      case '5M':
        startTime.setHours(now.getHours() - 4)
        break
      case '30M':
        startTime.setHours(now.getHours() - 12)
        break
      case '1H':
        startTime.setHours(now.getHours() - 24)
        break
      case '1D':
        startTime.setDate(now.getDate() - 7)
        break
      case '7D':
        startTime.setDate(now.getDate() - 30)
        break
    }

    const { data: priceUpdates, error } = await supabase
      .from('price_updates')
      .select('*')
      .eq('company_id', company.id)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

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

    // OHLC 데이터 생성 부분 수정
    const intervalMinutes = getTimeIntervalMinutes(timeframe)
    const timeSlots = generateTimeSlots(startTime, now, intervalMinutes)

    const ohlcData = new Map()
    let lastValidPrice: number | null = null

    timeSlots.forEach(timeSlot => {
      const key = timeSlot.getTime()
      const relevantUpdates = priceUpdates?.filter(update => {
        const updateTime = new Date(update.created_at)
        const slotEnd = new Date(timeSlot.getTime() + intervalMinutes * 60 * 1000)
        return updateTime >= timeSlot && updateTime < slotEnd
      })

      if (relevantUpdates?.length > 0) {
        // 해당 시간대에 데이터가 있는 경우
        const prices = relevantUpdates.map(u => u.new_price)
        lastValidPrice = prices[prices.length - 1]
        
        ohlcData.set(key, {
          x: key,
          y: [
            prices[0],                    // open
            Math.max(...prices),          // high
            Math.min(...prices),          // low
            lastValidPrice                // close
          ]
        })
      } else if (lastValidPrice !== null) {
        // 데이터가 없지만 이전 가격이 있는 경우
        ohlcData.set(key, {
          x: key,
          y: [
            lastValidPrice,  // open
            lastValidPrice,  // high
            lastValidPrice,  // low
            lastValidPrice   // close
          ],
          isEmpty: true      // 빈 캔들 표시용
        })
      }
    })

    const candleData = Array.from(ohlcData.values())

    return NextResponse.json({ 
      candleData,
      currentPrice: company.current_price,
      lastClosingPrice: company.last_closing_price
    })
  } catch (error) {
    console.error('가격 기록 조회 오류:', error)
    return NextResponse.json(
      { error: '가격 기록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 