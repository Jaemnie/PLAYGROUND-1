/**
 * 거래 완료 후 업적·미션 진행도 갱신
 * DB 트리거로 user_stats 반영 후 호출
 */
export async function notifyTradeComplete(
  type: 'buy' | 'sell',
  totalAmount: number,
  isProfitSell?: boolean
) {
  try {
    const eventTypes: string[] = ['trade']
    if (type === 'buy') eventTypes.push('buy')
    if (type === 'sell' && isProfitSell) eventTypes.push('profit_sell')

    await Promise.all([
      fetch('/api/achievements', { method: 'POST' }),
      ...eventTypes.map((eventType) =>
        fetch('/api/missions/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: eventType,
            value: 1,
            ...(eventType === 'trade' && { trade_amount: totalAmount }),
          }),
        })
      ),
    ])
  } catch {
    // 조용히 실패 (업적/미션 갱신 실패가 거래 자체를 막지 않음)
  }
}
