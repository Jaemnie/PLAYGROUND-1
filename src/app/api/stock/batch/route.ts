import { redis } from '@/lib/upstash-client';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { CACHE_TTL } from '@/constants/cache'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickers = searchParams.get('tickers')?.split(',');
  const BATCH_SIZE = 50;

  if (!tickers?.length) {
    return NextResponse.json(
      { error: 'tickers 파라미터가 필요합니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const results = new Map();

  // 배치 단위로 처리
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batchTickers = tickers.slice(i, i + BATCH_SIZE);
    
    // Redis에서 캐시된 데이터 일괄 조회
    const cachedData = await Promise.all(
      batchTickers.map(async (ticker) => {
        const key = `stock:${ticker}`;
        const cached = await redis.get(key);
        if (cached) results.set(ticker, cached);
        return { ticker, cached: Boolean(cached) };
      })
    );

    // 캐시되지 않은 티커만 DB에서 조회
    const uncachedTickers = batchTickers.filter(
      ticker => !results.has(ticker)
    );

    if (uncachedTickers.length > 0) {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .in('ticker', uncachedTickers);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 결과를 캐시에 저장하고 응답 맵에 추가
      await Promise.all(
        data?.map(async (company) => {
          const key = `stock:${company.ticker}`;
          await redis.set(key, company, { ex: CACHE_TTL.PRICE });
          results.set(company.ticker, company);
        }) ?? []
      );
    }
  }

  return NextResponse.json({
    companies: Object.fromEntries(results),
    cached: true
  });
} 