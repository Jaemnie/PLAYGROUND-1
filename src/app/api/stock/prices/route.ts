import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker')
    const timeframe = searchParams.get('timeframe')

    if (!ticker || !timeframe) {
      return NextResponse.json(
        { error: 'ticker와 timeframe 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // 회사 ID 조회
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('ticker', ticker)
      .single()

    if (!company) {
      return NextResponse.json({ error: '회사를 찾을 수 없습니다.' }, { status: 404 })
    }

    // timeframe에 따른 시간 범위 계산
    const now = new Date()
    const startDate = new Date()
    
    switch (timeframe) {
      case '1D':
        startDate.setDate(now.getDate() - 1)
        break
      case '1W':
        startDate.setDate(now.getDate() - 7)
        break
      case '1M':
        startDate.setMonth(now.getMonth() - 1)
        break
      case '3M':
        startDate.setMonth(now.getMonth() - 3)
        break
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
    }

    // transactions 테이블에서 거래 데이터 조회
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('created_at, price')
      .eq('company_id', company.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 시간별 평균 가격 계산
    const pricesByTime = transactions?.reduce((acc: { [key: string]: number[] }, tx) => {
      const timeKey = new Date(tx.created_at).toISOString()
      if (!acc[timeKey]) {
        acc[timeKey] = []
      }
      acc[timeKey].push(tx.price)
      return acc
    }, {})

    // 각 시간대별 평균 가격 계산
    const prices = Object.entries(pricesByTime || {}).map(([time, prices]) => ({
      time,
      price: prices.reduce((sum, price) => sum + price, 0) / prices.length
    }))

    return NextResponse.json({ prices })
  } catch (error) {
    return NextResponse.json(
      { error: '가격 데이터를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 