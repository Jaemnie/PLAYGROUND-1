import { toast } from 'sonner'

const rarityLabels: Record<string, string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
}

/**
 * 뉴스 읽음 보고 (클라이언트 전용)
 * - 중복 호출 시 API에서 스킵
 * - 업적/미션 완료 시 토스트 표시
 */
export async function reportNewsRead(newsId: string): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const res = await fetch('/api/news/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ news_id: newsId }),
    })
    const data = await res.json().catch(() => ({}))

    if (!data.firstRead) return

    // 미션 패널 갱신
    window.dispatchEvent(new CustomEvent('missions-updated'))

    // 업적 완료 토스트
    for (const u of data.unlocks || []) {
      const rarityLabel = rarityLabels[u.rarity] || u.rarity
      toast.success(`업적 달성! ${u.achievementName}`, {
        description: `${rarityLabel} · +${u.rewardGems}젬`,
        icon: '🏆',
        duration: 4000,
      })
    }

    // 미션 완료 토스트
    for (const m of data.completed || []) {
      toast.success(`미션 완료! ${m.name}`, {
        description: `보상 수령 가능 · +${m.reward_gems}젬`,
        icon: '🎯',
        duration: 4000,
      })
    }
  } catch {
    // 조용히 실패
  }
}
