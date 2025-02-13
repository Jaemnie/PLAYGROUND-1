import { redis } from '@/lib/upstash-client'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GuideItem } from '@/lib/types/guide'

const CACHE_TTL = 60 * 5 // 5분 캐시

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sectionIds = searchParams.get('section_ids')?.split(',')
  
  if (!sectionIds?.length) {
    return NextResponse.json(
      { error: 'section_ids 파라미터가 필요합니다.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const results = new Map()

  // Redis에서 캐시된 데이터 일괄 조회
  const cachedData = await Promise.all(
    sectionIds.map(async (id) => {
      const key = `guide_items:${id}`
      const cached = await redis.get(key)
      if (cached) results.set(id, cached)
      return { id, cached: Boolean(cached) }
    })
  )

  // 캐시되지 않은 섹션만 DB에서 조회
  const uncachedSectionIds = sectionIds.filter(
    id => !results.has(id)
  )

  if (uncachedSectionIds.length > 0) {
    const { data, error } = await supabase
      .from('guide_items')
      .select('*')
      .in('section_id', uncachedSectionIds)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 섹션별로 아이템 그룹화
    const itemsBySection = data?.reduce((acc, item) => {
      const items = acc.get(item.section_id) || []
      items.push(item)
      acc.set(item.section_id, items)
      return acc
    }, new Map<string, GuideItem[]>())

    // 결과를 캐시에 저장하고 응답 맵에 추가
    await Promise.all(
      Array.from(itemsBySection?.entries() || []).map(async (entry) => {
        const [sectionId, items] = entry as [string, GuideItem[]]
        const key = `guide_items:${sectionId}`
        await redis.set(key, items, { ex: CACHE_TTL })
        results.set(sectionId, items)
      })
    )
  }

  return NextResponse.json({
    items: Object.fromEntries(results),
    cached: true
  })
} 