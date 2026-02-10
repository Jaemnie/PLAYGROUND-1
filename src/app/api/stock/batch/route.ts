import { redis } from '@/lib/upstash-client';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { CACHE_TTL } from '@/constants/cache'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickers = searchParams.get('tickers')?.split(',').filter(Boolean);
  const ids = searchParams.get('ids')?.split(',').filter(Boolean);
  const BATCH_SIZE = 50;

  // ids 또는 tickers 중 하나 필요
  const useIds = ids?.length ? ids : null;
  const identifiers = useIds ?? tickers ?? [];

  if (!identifiers.length) {
    return NextResponse.json(
      { error: 'tickers 또는 ids 파라미터가 필요합니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const results = new Map<string, unknown>();

  // 현재 활성 시즌 테마 ID (시즌 기업만 조회로 리퀘스트 절감)
  const { data: activeSeason } = await supabase
    .from('seasons')
    .select('theme_id')
    .eq('status', 'active')
    .single()
  const themeId = activeSeason?.theme_id ?? null

  // 배치 단위로 처리
  for (let i = 0; i < identifiers.length; i += BATCH_SIZE) {
    const batchIds = identifiers.slice(i, i + BATCH_SIZE);

    if (useIds) {
      // ids 모드: Redis는 ticker 키 사용 → DB 조회 후 ticker로 캐시
      const uncachedIds = batchIds.filter(id => !results.has(id));
      if (uncachedIds.length > 0) {
        let query = supabase.from('companies').select('*').in('id', uncachedIds);
        if (themeId) {
          query = query.eq('theme_id', themeId);
        }
        const { data, error } = await query;
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        await Promise.all(
          (data ?? []).map(async (company) => {
            const key = `stock:${company.ticker}`;
            await redis.set(key, company, { ex: CACHE_TTL.PRICE });
            results.set(company.id, company);
          })
        );
      }
    } else {
      // tickers 모드: 기존 로직
      const batchTickers = batchIds as string[];
      await Promise.all(
        batchTickers.map(async (ticker) => {
          const key = `stock:${ticker}`;
          const cached = await redis.get(key);
          if (cached && typeof cached === 'object' && 'id' in cached) {
            results.set(ticker, cached);
          }
          return { ticker, cached: Boolean(cached) };
        })
      );

      const uncachedTickers = batchTickers.filter((t) => !results.has(t));

      if (uncachedTickers.length > 0) {
        let query = supabase.from('companies').select('*').in('ticker', uncachedTickers);
        if (themeId) {
          query = query.eq('theme_id', themeId);
        }
        const { data, error } = await query;
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        await Promise.all(
          (data ?? []).map(async (company) => {
            const key = `stock:${company.ticker}`;
            await redis.set(key, company, { ex: CACHE_TTL.PRICE });
            results.set(company.ticker, company);
          })
        );
      }
    }
  }

  return NextResponse.json({
    companies: Object.fromEntries(results),
    cached: true
  });
} 