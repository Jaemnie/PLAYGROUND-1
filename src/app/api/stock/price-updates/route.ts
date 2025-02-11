import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Redis } from 'ioredis'

const redis = new Redis()

async function calculatePriceChange(
  currentPrice: number,
  transactionVolume: number,
  marketEventImpact: number
): Promise<number> {
  // 거래량 기반 가격 변동 (거래량이 많을수록 가격 변동폭 증가)
  const volumeImpact = (transactionVolume / 10000) * 0.01 
  
  // 시장 이벤트 영향
  const eventImpact = marketEventImpact || 0
  
  // 무작위 변동 (-0.5% ~ 0.5%)
  const randomChange = (Math.random() - 0.5) * 0.01
  
  // 전체 변동률 계산
  const totalChange = volumeImpact + eventImpact + randomChange
  
  return currentPrice * (1 + totalChange)
}

export async function POST() {
  const supabase = await createClient()
  
  try {
    // 1. 최근 거래 데이터 조회
    const { data: transactions } = await supabase
      .from('transactions')
      .select('company_id, shares')
      .gte('created_at', new Date(Date.now() - 5 * 60000).toISOString()) // 최근 5분
    
    // 2. 활성 시장 이벤트 조회
    const { data: marketEvents } = await supabase
      .from('market_events')
      .select('*')
      .lte('effective_at', new Date().toISOString())
      
    // 3. 각 기업별 주가 업데이트
    const { data: companies } = await supabase
      .from('companies')
      .select('id, current_price')
    
    const updates = await Promise.all(
      (companies || []).map(async (company) => {
        const companyTransactions = transactions?.filter(t => t.company_id === company.id) || [];
        const totalVolume = companyTransactions.reduce((sum, t) => sum + t.shares, 0);
        const eventImpact = marketEvents?.reduce((sum, event) => sum + (event.impact || 0), 0) || 0;
        
        const newPrice = await calculatePriceChange(
          company.current_price,
          totalVolume,
          eventImpact
        );

        return {
          id: crypto.randomUUID(), // UUID 생성
          company_id: company.id,
          old_price: Number(company.current_price), // numeric 타입으로 변환
          new_price: Number(newPrice), // numeric 타입으로 변환
          change_percentage: Number(((newPrice - company.current_price) / company.current_price) * 100),
          update_reason: 'Regular update',
          created_at: new Date().toISOString() // timestamptz 필드 추가
        };
      })
    );

    // 배치 처리로 변경
    const { error: insertError } = await supabase
      .from('price_updates')
      .insert(updates);

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

    // 캐시 무효화
    await Promise.all(
      companyUpdates.map(async (update) => {
        const key = `stock:${update.id}`;
        await redis.del(key);
      })
    );
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Price update error:', error)
    return NextResponse.json({ error: '가격 업데이트 중 오류가 발생했습니다.' }, { status: 500 })
  }
}