import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/upstash-client'

async function calculatePriceChange(
  currentPrice: number,
  marketEventImpact: number
): Promise<number> {
  // 시장 이벤트 영향
  const eventImpact = marketEventImpact || 0
  
  // 무작위 변동 (-0.5% ~ 0.5%)
  const randomChange = (Math.random() - 0.5) * 0.01
  
  // 전체 변동률 계산
  const totalChange = eventImpact + randomChange
  
  return currentPrice * (1 + totalChange)
}

export async function POST() {
  const supabase = await createClient()
  
  try {
    // 현재 활성 시즌 테마 ID 조회
    const { data: activeSeason } = await supabase
      .from('seasons')
      .select('theme_id')
      .eq('status', 'active')
      .single()

    const themeId = activeSeason?.theme_id ?? null
    if (!themeId) {
      return NextResponse.json({ success: true, skipped: true, reason: 'no_active_season' })
    }

    // 1. 활성 시장 이벤트 조회
    const { data: marketEvents } = await supabase
      .from('market_events')
      .select('*')
      .lte('effective_at', new Date().toISOString())
      
    // 2. 각 기업별 주가 업데이트 (현재 시즌 테마 기업만)
    const { data: companies } = await supabase
      .from('companies')
      .select('id, current_price, ticker')
      .eq('theme_id', themeId)
    
    const updates = await Promise.all(
      (companies || []).map(async (company) => {
        const eventImpact = marketEvents?.reduce((sum, event) => sum + (event.impact || 0), 0) || 0;
        
        const newPrice = await calculatePriceChange(
          company.current_price,
          eventImpact
        );

        return {
          id: crypto.randomUUID(),
          company_id: company.id,
          ticker: company.ticker, // 캐시 무효화용 (price_updates 테이블에는 insert 안 함)
          old_price: Number(company.current_price),
          new_price: Number(newPrice),
          change_percentage: Number(((newPrice - company.current_price) / company.current_price) * 100),
          update_reason: 'Regular update',
          created_at: new Date().toISOString()
        };
      })
    );

    // 배치 처리로 변경 (price_updates 테이블에는 ticker 제외)
    const insertPayload = updates.map(({ ticker, ...rest }) => rest)
    const { error: insertError } = await supabase
      .from('price_updates')
      .insert(insertPayload);

    if (insertError) {
      console.error('Price updates insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 회사 정보 업데이트도 배치로 처리
    const companyUpdates = updates.map(update => ({
      id: update.company_id,
      current_price: update.new_price
    }));

    const { error: updateError } = await supabase
      .from('companies')
      .upsert(companyUpdates, { onConflict: 'id' });

    if (updateError) {
      console.error('Companies update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 캐시 무효화 (Redis 키는 ticker 기준)
    await Promise.all(
      updates.map(async (update) => {
        if (update.ticker) {
          const key = `stock:${update.ticker}`;
          await redis.del(key);
        }
      })
    );
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Price update error:', error)
    return NextResponse.json({ error: '가격 업데이트 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
