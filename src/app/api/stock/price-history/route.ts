import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 장 운영 시간 (KST 9:00 ~ 24:00)
const MARKET_OPEN_HOUR = 9
const MARKET_CLOSE_HOUR = 24
const KST_OFFSET_HOURS = 9

function getKSTHour(date: Date): number {
  return (date.getUTCHours() + KST_OFFSET_HOURS) % 24
}

function isWithinMarketHours(date: Date): boolean {
  const kstHour = getKSTHour(date)
  return kstHour >= MARKET_OPEN_HOUR && kstHour < MARKET_CLOSE_HOUR
}

function getTimeIntervalMinutes(timeframe: string): number {
  switch (timeframe) {
    case '1M': return 1
    case '5M': return 5
    case '30M': return 30
    case '1H': return 60
    case '1D': return 24 * 60
    case '1W': return 7 * 24 * 60
    default: return 5
  }
}

function getDataRange(timeframe: string, now: Date): Date {
  const startTime = new Date(now)
  switch (timeframe) {
    case '1M':
      startTime.setHours(now.getHours() - 6)
      break
    case '5M':
      startTime.setHours(now.getHours() - 24)
      break
    case '30M':
      startTime.setDate(now.getDate() - 3)
      break
    case '1H':
      startTime.setDate(now.getDate() - 7)
      break
    case '1D':
      startTime.setDate(now.getDate() - 30)
      break
    case '1W':
      startTime.setDate(now.getDate() - 90)
      break
  }
  return startTime
}

function generateTimeSlots(startTime: Date, endTime: Date, intervalMinutes: number): Date[] {
  const slots: Date[] = []
  const currentTime = new Date(startTime)

  while (currentTime <= endTime) {
    slots.push(new Date(currentTime))
    currentTime.setTime(currentTime.getTime() + intervalMinutes * 60 * 1000)
  }

  return slots
}

// 장 미개장 시간(KST 0~8시)에 조회 시 슬롯 생성 기준을 마지막 장 마감 시각으로 조정
// 이를 통해 0~8시 슬롯이 생성되지 않으면서도 이전 거래일 히스토리는 완전히 표시됨
function getEffectiveEndTime(now: Date, needsMarketHoursFilter: boolean): Date {
  if (!needsMarketHoursFilter) return now

  const kstHour = getKSTHour(now)
  if (kstHour < MARKET_OPEN_HOUR) {
    // 장 미개장 상태: 마지막 장 마감 시각(KST 자정 = UTC 15:00)으로 대체
    const effectiveEnd = new Date(now)
    effectiveEnd.setUTCHours(15, 0, 0, 0)
    return effectiveEnd
  }
  return now
}

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
    const startTime = getDataRange(timeframe, now)

    const { data: priceUpdates, error } = await supabase
      .from('price_updates')
      .select('*')
      .eq('company_id', company.id)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    const intervalMinutes = getTimeIntervalMinutes(timeframe)

    // 장 마감 시간 필터가 필요한 타임프레임 (시간봉 이하)
    const needsMarketHoursFilter = !['1D', '1W'].includes(timeframe)
    const effectiveEnd = getEffectiveEndTime(now, needsMarketHoursFilter)
    const timeSlots = generateTimeSlots(startTime, effectiveEnd, intervalMinutes)

    const candleData: { time: number; open: number; high: number; low: number; close: number }[] = []
    let lastValidPrice: number | null = null

    timeSlots.forEach(timeSlot => {
      // 장 마감 시간 슬롯 건너뛰기 (1D/1W 제외)
      if (needsMarketHoursFilter && !isWithinMarketHours(timeSlot)) {
        return
      }

      const slotStart = timeSlot.getTime()
      const slotEnd = slotStart + intervalMinutes * 60 * 1000

      const relevantUpdates = priceUpdates?.filter(update => {
        const updateTime = new Date(update.created_at).getTime()
        return updateTime >= slotStart && updateTime < slotEnd
      })

      if (relevantUpdates && relevantUpdates.length > 0) {
        const prices = relevantUpdates.map(u => u.new_price)
        lastValidPrice = prices[prices.length - 1]
        
        candleData.push({
          time: Math.floor(slotStart / 1000), // lightweight-charts는 초 단위 Unix timestamp
          open: prices[0],
          high: Math.max(...prices),
          low: Math.min(...prices),
          close: lastValidPrice!
        })
      } else if (lastValidPrice !== null) {
        // 장중이지만 데이터가 없는 경우 - 이전 가격으로 채움
        candleData.push({
          time: Math.floor(slotStart / 1000),
          open: lastValidPrice,
          high: lastValidPrice,
          low: lastValidPrice,
          close: lastValidPrice
        })
      }
    })

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
