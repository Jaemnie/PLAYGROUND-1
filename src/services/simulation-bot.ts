import { createClient } from '@/lib/supabase/server';
import { validate as uuidValidate } from 'uuid';
import { getDbTimeISOString } from '@/lib/timeUtils';

// .env 파일 등에서 BOT_USER_ID에 올바른 uuid 값을 설정해야 합니다.
// 예: BOT_USER_ID= "4c8f95c0-0d9e-4de9-ace3-2f8d3e378e90"
const BOT_USER_ID = process.env.BOT_USER_ID || '00000000-0000-0000-0000-000000000000';

if (!uuidValidate(BOT_USER_ID)) {
  throw new Error('BOT_USER_ID 환경변수에 올바른 uuid 값이 설정되어야 합니다.');
}

export async function simulateMarketControlBot() {
  const supabase = await createClient();

  // 조작 강도: 주문량에 추가되는 비율 (예: 10% ~ 30% 증가)
  const manipulationIntensity = 0.1 + Math.random() * 0.2;

  // 모든 기업 데이터를 조회 (현재가, 시가총액, 전일 종가, 상장폐지 상태 포함)
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id, current_price, market_cap, last_closing_price, is_delisted');
  if (companyError || !companies || companies.length === 0) {
    console.error('기업 데이터를 불러오지 못했습니다.', companyError);
    return;
  }

  // 모든 기업에 대해 동시에 주문 실행 (전체 시장에 걸쳐 매수, 매도 주문을 내도록 함)
  await Promise.all(
    companies.map(async (company) => {
      // 상장폐지된 주식은 제외
      if (company.is_delisted) {
        console.log(`시장 조율 봇: ${company.id}은 이미 상장폐지 상태이므로 주문을 실행하지 않습니다.`);
        return;
      }

      // 각 기업마다 주문 타입 결정
      // 예시: 전일 종가 대비 현재가가 하락했다면 매수, 상승했다면 매도하는 기본 전략에 무작위성을 추가
      const priceDiff = company.current_price - company.last_closing_price;
      let orderType: 'buy' | 'sell' = priceDiff < 0 ? 'buy' : 'sell';
      if (Math.random() < 0.3) {
        // 약 30% 확률로 주문 타입을 반전시켜 다양한 주문 제공
        orderType = orderType === 'buy' ? 'sell' : 'buy';
      }

      // 기업의 시장 규모에 따라 기본 주문량 산정 후 조작 강도 반영
      const baseOrderVolume = Math.floor(Math.random() * 100) + 1;
      const volumeMultiplier = company.market_cap / 1_000_000_000;
      let manipulatedShares = Math.max(1, Math.floor(baseOrderVolume * volumeMultiplier * (1 + manipulationIntensity)));

      // BOT의 보유 현황 조회
      const { data: existingHolding, error: holdingError } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', BOT_USER_ID)
        .eq('company_id', company.id)
        .maybeSingle();
      if (holdingError) {
        console.error(`보유 현황 조회 오류 (회사: ${company.id}):`, holdingError);
        return;
      }

      // 매도 주문 시 보유 주식이 부족하면 매수 주문으로 강제 전환
      if (orderType === 'sell' && (!existingHolding || existingHolding.shares < manipulatedShares)) {
        orderType = 'buy';
      }

      // 주문 실행: 매수인 경우 보유 업데이트 또는 신규 생성, 매도인 경우 보유 차감 또는 삭제
      if (orderType === 'buy') {
        if (existingHolding) {
          const totalShares = existingHolding.shares + manipulatedShares;
          const newAvgCost =
            ((existingHolding.average_cost * existingHolding.shares) +
              (company.current_price * manipulatedShares)) /
            totalShares;
          const { error: updateError } = await supabase
            .from('holdings')
            .update({
              shares: totalShares,
              average_cost: newAvgCost,
              updated_at: getDbTimeISOString()
            })
            .eq('id', existingHolding.id);
          if (updateError) {
            console.error(`시장 조율 봇(매수) 업데이트 오류 (회사: ${company.id}):`, updateError);
          } else {
            console.log(`시장 조율 봇: ${company.id}에서 매수 주문 실행 - 추가 ${manipulatedShares}주, 총 보유: ${totalShares}주`);
          }
        } else {
          const { error: insertError } = await supabase
            .from('holdings')
            .insert({
              user_id: BOT_USER_ID,
              company_id: company.id,
              shares: manipulatedShares,
              average_cost: company.current_price,
              updated_at: getDbTimeISOString()
            });
          if (insertError) {
            console.error(`시장 조율 봇(매수) 생성 오류 (회사: ${company.id}):`, insertError);
          } else {
            console.log(`시장 조율 봇: ${company.id}에서 신규 매수 주문 실행 - ${manipulatedShares}주 구매됨`);
          }
        }
      } else {
        if (existingHolding && existingHolding.shares >= manipulatedShares) {
          const remainingShares = existingHolding.shares - manipulatedShares;
          if (remainingShares > 0) {
            const { error: updateError } = await supabase
              .from('holdings')
              .update({
                shares: remainingShares,
                updated_at: getDbTimeISOString()
              })
              .eq('id', existingHolding.id);
            if (updateError) {
              console.error(`시장 조율 봇(매도) 업데이트 오류 (회사: ${company.id}):`, updateError);
            } else {
              console.log(`시장 조율 봇: ${company.id}에서 매도 주문 실행 - 판매 ${manipulatedShares}주, 남은 주식: ${remainingShares}주`);
            }
          } else {
            const { error: deleteError } = await supabase
              .from('holdings')
              .delete()
              .eq('id', existingHolding.id);
            if (deleteError) {
              console.error(`시장 조율 봇(매도) 삭제 오류 (회사: ${company.id}):`, deleteError);
            } else {
              console.log(`시장 조율 봇: ${company.id}에서 전량 매도 - 보유 기록 삭제됨`);
            }
          }
        } else {
          console.error(`시장 조율 봇: ${company.id}에서 매도 주문 실패 - 판매할 주식이 부족합니다.`);
        }
      }
    })
  );

  console.log('전체 시장 조율 봇 주문 실행 완료');
} 