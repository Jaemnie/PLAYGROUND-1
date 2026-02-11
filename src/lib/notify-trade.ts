import { toast } from 'sonner'

const rarityLabels: Record<string, string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
}

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

    // 업적 체크
    const achievementsRes = await fetch('/api/achievements', { method: 'POST' })
    const achievementsData = await achievementsRes.json().catch(() => ({}))
    const unlocks = achievementsData.unlocks || []

    // 미션 진행도 갱신 (여러 이벤트에 대해)
    const missionResults = await Promise.all(
      eventTypes.map((eventType) =>
        fetch('/api/missions/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: eventType,
            value: 1,
            ...(eventType === 'trade' && { trade_amount: totalAmount }),
          }),
        })
          .then((r) => r.json().catch(() => ({})))
          .then((d) => d.completed || [])
      )
    )
    const completedMissions = missionResults.flat()

    // 업적·미션 완료 토스트 (오른쪽 하단)
    if (typeof window !== 'undefined') {
      for (const u of unlocks) {
        const rarityLabel = rarityLabels[u.rarity] || u.rarity
        toast.success(`업적 달성! ${u.achievementName}`, {
          description: `${rarityLabel} · +${u.rewardGems}젬`,
          icon: '🏆',
          duration: 4000,
        })
      }
      for (const m of completedMissions) {
        toast.success(`미션 완료! ${m.name}`, {
          description: `보상 수령 가능 · +${m.reward_gems}젬`,
          icon: '🎯',
          duration: 4000,
        })
      }
      window.dispatchEvent(new CustomEvent('missions-updated'))
    }
  } catch {
    // 조용히 실패 (업적/미션 갱신 실패가 거래 자체를 막지 않음)
  }
}
