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

    // 시간대별로 OHLC 데이터 생성
    const ohlcData = new Map()
    
    priceUpdates?.forEach(update => {
      const timeKey = new Date(update.created_at)
      
      if (timeframe === '1M') {
        timeKey.setSeconds(0, 0)
      } else {
        timeKey.setSeconds(0, 0)
        
        if (timeframe === '5M') {
          timeKey.setMinutes(Math.floor(timeKey.getMinutes() / 5) * 5)
        } else if (timeframe === '30M') {
          timeKey.setMinutes(Math.floor(timeKey.getMinutes() / 30) * 30)
        } else if (timeframe === '1H') {
          timeKey.setMinutes(0)
        } else if (timeframe === '1D') {
          timeKey.setHours(0, 0, 0)
        }
      }
      
      const key = timeKey.getTime()
      
      if (!ohlcData.has(key)) {
        ohlcData.set(key, {
          x: timeKey.getTime(),
          y: [
            update.new_price, // open
            update.new_price, // high
            update.new_price, // low
            update.new_price  // close
          ]
        })
      } else {
        const current = ohlcData.get(key)
        current.y[1] = Math.max(current.y[1], update.new_price) // high
        current.y[2] = Math.min(current.y[2], update.new_price) // low
        current.y[3] = update.new_price // close
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