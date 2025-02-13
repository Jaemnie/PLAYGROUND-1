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
      .select('id')
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
        startTime.setMinutes(now.getMinutes() - 60) // 최근 60분의 1분봉
        break
      case '5M':
        startTime.setHours(now.getHours() - 4) // 최근 4시간의 5분봉
        break
      case '30M':
        startTime.setHours(now.getHours() - 12) // 최근 12시간의 30분봉
        break
      case '1H':
        startTime.setHours(now.getHours() - 24) // 최근 24시간의 1시간봉
        break
      case '1D':
        startTime.setDate(now.getDate() - 7) // 최근 7일의 일봉
        break
      case '7D':
        startTime.setDate(now.getDate() - 30) // 최근 30일의 주봉
        break
    }

    const { data: priceUpdates, error } = await supabase
      .from('price_updates')
      .select('*')
      .eq('company_id', company.id)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    const generateTimeSlots = (startTime: Date, endTime: Date, interval: number) => {
      const slots = [];
      let current = new Date(startTime);
      
      while (current <= endTime) {
        slots.push(new Date(current));
        current = new Date(current.getTime() + interval * 60000); // interval분 단위로 증가
      }
      return slots;
    };

    const getIntervalMinutes = (timeframe: string) => {
      switch (timeframe) {
        case '1M': return 1;
        case '5M': return 5;
        case '30M': return 30;
        case '1H': return 60;
        case '1D': return 24 * 60;
        case '7D': return 7 * 24 * 60;
        default: return 1;
      }
    };

    // 모든 시간대에 대해 동일한 처리
    const interval = getIntervalMinutes(timeframe);
    const timeSlots = generateTimeSlots(startTime, now, interval);

    const formattedUpdates = timeSlots.map(slot => {
      const slotEnd = new Date(slot.getTime() + interval * 60000);
      const update = priceUpdates?.find(u => {
        const updateTime = new Date(u.created_at);
        return updateTime >= slot && updateTime < slotEnd;
      });
      
      return {
        created_at: slot.toISOString(),
        new_price: update?.new_price || null,
        change_percentage: update?.change_percentage || null
      };
    });

    return NextResponse.json({ priceUpdates: formattedUpdates });
  } catch (error) {
    console.error('가격 기록 조회 오류:', error)
    return NextResponse.json(
      { error: '가격 기록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 