import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

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
    const activeEvents = (eventsResult.data || []).filter((event) => {
      const elapsed = (Date.now() - new Date(event.effective_at).getTime()) / (60 * 1000)
      return elapsed <= event.duration_minutes
    })

    return NextResponse.json({
      marketPhase: marketState?.market_phase || 'neutral',
      phaseStartedAt: marketState?.phase_started_at || null,
      sectorTrends: marketState?.sector_trends || {},
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
