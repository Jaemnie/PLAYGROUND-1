import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

// 상점 아이템 조회
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const [{ data: items }, { data: inventory }, { data: profile }] = await Promise.all([
    supabase.from('shop_items').select('*').order('category').order('price_gems'),
    supabase.from('user_inventory').select('item_id').eq('user_id', user.id),
    supabase.from('profiles').select('gems, equipped_frame, nickname_color, equipped_badge').eq('id', user.id).single(),
  ])

  const ownedItemIds = new Set((inventory || []).map(i => i.item_id))

  const enrichedItems = (items || []).map(item => ({
    ...item,
    owned: ownedItemIds.has(item.id),
  }))

  return NextResponse.json({
    items: enrichedItems,
    gems: profile?.gems || 0,
    equipped: {
      frame: profile?.equipped_frame,
      nickname_color: profile?.nickname_color,
      badge: profile?.equipped_badge,
    },
  })
}

// 아이템 구매
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { item_id } = await request.json()

  // 아이템 정보 조회
  const { data: item } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', item_id)
    .single()

  if (!item) return NextResponse.json({ error: '아이템 없음' }, { status: 404 })

  // 이미 보유 확인
  const { data: existing } = await supabase
    .from('user_inventory')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_id', item_id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: '이미 보유 중' }, { status: 400 })

  // 한정판 기간 확인
  if (item.is_limited && item.available_until && new Date(item.available_until) < new Date()) {
    return NextResponse.json({ error: '판매 기간 종료' }, { status: 400 })
  }

  // 재고 확인
  if (item.stock !== null && item.stock <= 0) {
    return NextResponse.json({ error: '재고 소진' }, { status: 400 })
  }

  // 젬 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('gems')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.gems || 0) < item.price_gems) {
    return NextResponse.json({ error: '젬 부족' }, { status: 400 })
  }

  // 구매 처리
  await supabase.from('profiles').update({ gems: profile.gems - item.price_gems }).eq('id', user.id)
  await supabase.from('user_inventory').insert({ user_id: user.id, item_id, source: 'shop' })

  // 재고 차감
  if (item.stock !== null) {
    await supabase.from('shop_items').update({ stock: item.stock - 1 }).eq('id', item_id)
  }

  return NextResponse.json({ success: true, remaining_gems: profile.gems - item.price_gems })
}

// 아이템 장착/해제
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { slot, value } = await request.json() // slot: 'frame'|'nickname_color'|'badge', value: string|null

  const validSlots = ['equipped_frame', 'nickname_color', 'equipped_badge']
  const slotKey = slot === 'frame' ? 'equipped_frame' : slot === 'badge' ? 'equipped_badge' : slot

  if (!validSlots.includes(slotKey)) {
    return NextResponse.json({ error: '잘못된 슬롯' }, { status: 400 })
  }

  await supabase.from('profiles').update({ [slotKey]: value }).eq('id', user.id)

  return NextResponse.json({ success: true })
}
