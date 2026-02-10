import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShopClient } from './shop-client'

export default async function ShopPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: items }, { data: inventory }, { data: profile }] = await Promise.all([
    supabase.from('shop_items').select('*').order('category').order('price_gems'),
    supabase.from('user_inventory').select('item_id, source').eq('user_id', user.id),
    supabase.from('profiles').select('gems, equipped_frame, nickname_color, equipped_badge').eq('id', user.id).single(),
  ])

  const ownedItemIds = new Set((inventory || []).map(i => i.item_id))

  const enrichedItems = (items || []).map(item => ({
    ...item,
    owned: ownedItemIds.has(item.id),
  }))

  return (
    <ShopClient
      items={enrichedItems}
      gems={profile?.gems || 0}
      equipped={{
        frame: profile?.equipped_frame || null,
        nickname_color: profile?.nickname_color || null,
        badge: profile?.equipped_badge || null,
      }}
    />
  )
}
