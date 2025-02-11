import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/upstash-client'
import { CACHE_TTL } from '@/constants/cache'

export async function GET() {
  try {
    const cacheKey = 'scheduler-status';
    const cachedStatus = await redis.get(cacheKey);
    
    if (cachedStatus) {
      const parsedCache = typeof cachedStatus === 'string' 
        ? JSON.parse(cachedStatus) 
        : cachedStatus;
      return NextResponse.json({ status: parsedCache, cached: true });
    }

    const supabase = await createClient();
    const { data: statusData, error } = await supabase
      .from('scheduler_status')
      .select('*')
      .in('job_type', ['market_update', 'news_generation'])
      .order('updated_at', { ascending: false })
      .limit(2);

    if (error) throw error;

    const latestStatus = statusData.reduce((acc: any[], curr) => {
      const existingIndex = acc.findIndex(item => item.job_type === curr.job_type);
      if (existingIndex === -1) {
        acc.push({
          id: curr.id,
          status: curr.status,
          lastRun: curr.last_run,
          nextRun: curr.next_run,
          errorMessage: curr.error_message,
          jobType: curr.job_type
        });
      }
      return acc;
    }, []);

    await redis.set(cacheKey, JSON.stringify(latestStatus), { 
      ex: CACHE_TTL.SCHEDULER 
    });

    return NextResponse.json({ status: latestStatus, cached: false });
  } catch (error) {
    console.error('스케줄러 상태 조회 오류:', error);
    return NextResponse.json(
      { error: '스케줄러 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
