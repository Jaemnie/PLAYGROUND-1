import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** 섹터 트렌드 수치를 3단계 방향으로 양자화 (정확한 수치 비노출) */
function quantizeSectorTrends(
  raw: Record<string, number>
): Record<string, 'bullish' | 'neutral' | 'bearish'> {
  const quantized: Record<string, 'bullish' | 'neutral' | 'bearish'> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value > 0.25) {
      quantized[key] = 'bullish'
    } else if (value < -0.25) {
      quantized[key] = 'bearish'
    } else {
      quantized[key] = 'neutral'
    }
  }
  return quantized
}

export async function GET() {
  try {
    const supabase = await createClient()

    // 현재 시즌 테마 산업 (필터링용)
    const { data: activeSeason } = await supabase
      .from('seasons')
      .select('theme_id')
      .eq('status', 'active')
      .single()

    const themeIndustries = activeSeason?.theme_id
      ? (await supabase.from('companies').select('industry').eq('theme_id', activeSeason.theme_id))
          .data?.map((c) => c.industry as string) ?? []
      : []
    const themeIndustrySet = new Set(themeIndustries)

    const [marketStateResult, eventsResult] = await Promise.all([
      supabase
        .from('market_state')
        .select('market_phase, phase_started_at, sector_trends, sector_trends_updated_at')
        .limit(1)
        .single(),
      supabase
        .from('market_events')
        .select('title, sentiment, impact, affected_industries, duration_minutes, effective_at')
        .eq('is_active', true),
    ])

    const marketState = marketStateResult.data
    let activeEvents = (eventsResult.data || []).filter((event) => {
      const elapsed = (Date.now() - new Date(event.effective_at).getTime()) / (60 * 1000)
      return elapsed <= event.duration_minutes
    })

    // 현재 시즌 테마에 맞게 이벤트 필터링 (affected_industries 빈 배열이거나 테마 산업과 겹치는 이벤트만)
    if (themeIndustrySet.size > 0) {
      activeEvents = activeEvents.filter((event) => {
        const affected = (event.affected_industries || []) as string[]
        if (affected.length === 0) return true
        return affected.some((ind) => themeIndustrySet.has(ind))
      })
    }

    // 섹터 트렌드를 3단계로 양자화, 현재 시즌 테마 산업만 반환
    const rawTrends = (marketState?.sector_trends || {}) as Record<string, number>
    const filteredRawTrends =
      themeIndustrySet.size > 0
        ? Object.fromEntries(
            Object.entries(rawTrends).filter(([k]) => themeIndustrySet.has(k))
          )
        : rawTrends
    const quantizedTrends = quantizeSectorTrends(filteredRawTrends)

    return NextResponse.json({
      marketPhase: marketState?.market_phase || 'neutral',
      phaseStartedAt: marketState?.phase_started_at || null,
      sectorTrends: quantizedTrends,
      sectorTrendsUpdatedAt: marketState?.sector_trends_updated_at || null,
      activeEvents: activeEvents.map((event) => ({
        title: event.title,
        sentiment: event.sentiment,
        impact: event.impact,
        affectedIndustries: event.affected_industries,
        durationMinutes: event.duration_minutes,
        effectiveAt: event.effective_at,
      })),
    })
  } catch (error) {
    console.error('Market info fetch failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market info' },
      { status: 500 }
    )
  }
}
