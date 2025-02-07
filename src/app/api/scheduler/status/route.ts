import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/upstash-client'

export async function GET() {
  try {
    // Redis 캐시에서 데이터를 조회합니다.
    const cachedStatus = await redis.get('scheduler-status')
    if (cachedStatus) {
      const parsedCache =
        typeof cachedStatus === 'string' ? JSON.parse(cachedStatus) : cachedStatus
      return NextResponse.json({ status: parsedCache, cached: true })
    }

    const supabase = await createClient()
    
    // 시장 업데이트와 뉴스 생성에 대한 최신 상태만 조회
    const { data: statusData, error } = await supabase
      .from('scheduler_status')
      .select('*')
      .in('job_type', ['market_update', 'news_generation'])
      .order('updated_at', { ascending: false })
      .limit(2)
    
    if (error) {
      throw error
    }

    // 작업 유형별로 최신 상태만 필터링
    const latestStatus = statusData.reduce((acc: any[], curr) => {
      const existingIndex = acc.findIndex(item => item.job_type === curr.job_type)
      if (existingIndex === -1) {
        acc.push({
          id: curr.id,
          status: curr.status,
          lastRun: curr.last_run,
          nextRun: curr.next_run,
          errorMessage: curr.error_message,
          jobType: curr.job_type
        })
      }
      return acc
    }, [])

    // 결과를 Redis에 캐싱 (50초 동안 캐시)
    await redis.set('scheduler-status', JSON.stringify(latestStatus), { ex: 60 })

    return NextResponse.json({ status: latestStatus, cached: false })
  } catch (error) {
    console.error('스케줄러 상태 조회 오류:', error)
    return NextResponse.json(
      { error: '스케줄러 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
