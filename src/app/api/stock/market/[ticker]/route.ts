import { redis } from '@/lib/upstash-client'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  const { ticker } = params
  const CACHE_TTL = 60 // 1분 캐시

  // 1. Redis 캐시 확인
  const redisKey = `stock:${ticker}`
  const cachedData = await redis.get(redisKey)
  
  if (cachedData) {
    return NextResponse.json({ company: cachedData, cached: true })
  }

  // 2. DB 조회
  const supabase = await createClient()
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('ticker', ticker)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!company) {
    return NextResponse.json({ error: '회사를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 3. Redis에 캐시 저장
  await redis.set(redisKey, company, { ex: CACHE_TTL })

  return NextResponse.json({ company, cached: false })
} 