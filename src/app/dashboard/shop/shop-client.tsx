'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Gem, Check, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'

interface ShopItem {
  id: string
  code: string
  name: string
  description: string | null
  category: string
  rarity: string
  price_gems: number
  preview_data: Record<string, unknown> | null
  is_limited: boolean
  owned: boolean
}

interface ShopClientProps {
  items: ShopItem[]
  gems: number
  equipped: {
    frame: string | null
    nickname_color: string | null
    badge: string | null
  }
}

const categories = [
  { key: 'all', label: '전체' },
  { key: 'frame', label: '프레임' },
  { key: 'nickname_color', label: '닉네임 색상' },
  { key: 'badge', label: '뱃지' },
  { key: 'trade_effect', label: '거래 이펙트' },
  { key: 'boost', label: '편의' },
]

const rarityColors: Record<string, { border: string; bg: string; text: string }> = {
  common: { border: 'border-zinc-700/50', bg: 'bg-zinc-800/60', text: 'text-zinc-300' },
  rare: { border: 'border-blue-700/50', bg: 'bg-blue-900/30', text: 'text-blue-300' },
  epic: { border: 'border-purple-700/50', bg: 'bg-purple-900/30', text: 'text-purple-300' },
  legendary: { border: 'border-amber-700/50', bg: 'bg-amber-900/30', text: 'text-amber-300' },
}

const rarityLabels: Record<string, string> = {
  common: '일반', rare: '레어', epic: '에픽', legendary: '전설',
}

export function ShopClient({ items, gems: initialGems, equipped }: ShopClientProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [gems, setGems] = useState(initialGems)
  const [ownedItems, setOwnedItems] = useState(new Set(items.filter(i => i.owned).map(i => i.id)))
  const [buyingId, setBuyingId] = useState<string | null>(null)

  const filtered = selectedCategory === 'all' ? items : items.filter(i => i.category === selectedCategory)

  const handleBuy = async (item: ShopItem) => {
    if (gems < item.price_gems) {
      toast.error('젬이 부족합니다!')
      return
    }

    setBuyingId(item.id)
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id }),
      })
      const data = await res.json()

      if (data.success) {
        setGems(data.remaining_gems)
        setOwnedItems(prev => new Set([...prev, item.id]))
        toast.success(`${item.name} 구매 완료!`)
      } else {
        toast.error(data.error || '구매 실패')
      }
    } catch {
      toast.error('구매 중 오류 발생')
    }
    setBuyingId(null)
  }

  const handleEquip = async (slot: string, value: string | null) => {
    await fetch('/api/shop', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, value }),
    })
    toast.success(value ? '장착 완료!' : '해제 완료!')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Button
            type="button"
            className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70 flex items-center gap-2"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
            <span className="text-zinc-200">대시보드</span>
          </Button>
        </motion.div>
      </div>

      <section className="pt-20 pb-4 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">STACKS</p>
            <h1 className="text-2xl font-bold text-gray-100">상점</h1>
            <span className="flex items-center gap-1 text-sm text-amber-300 mt-2">
              <Gem className="w-4 h-4" />
              {gems.toLocaleString()} 젬
            </span>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-2">
        <div className="container mx-auto max-w-5xl">
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.key
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800/60 text-gray-400 hover:text-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((item, index) => {
              const isOwned = ownedItems.has(item.id)
              const colors = rarityColors[item.rarity] || rarityColors.common
              const previewColor = (item.preview_data?.color as string) || '#888'

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card className={`rounded-xl border backdrop-blur-sm p-4 ${colors.bg} ${colors.border}`}>
                    {/* 미리보기 */}
                    <div className="flex items-center justify-center h-16 mb-3 rounded-lg bg-black/30">
                      <div
                        className="w-10 h-10 rounded-lg border-2"
                        style={{ borderColor: previewColor, background: `${previewColor}20` }}
                      />
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-100 truncate">{item.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 ${colors.text} shrink-0`}>
                        {rarityLabels[item.rarity]}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{item.description}</p>
                    )}

                    {item.is_limited && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 mb-2">
                        한정판
                      </span>
                    )}

                    {isOwned ? (
                      <Button size="sm" className="w-full bg-green-600/20 text-green-300 border border-green-600/30 hover:bg-green-600/30" disabled>
                        <Check className="w-4 h-4 mr-1" />
                        보유 중
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full bg-violet-600 hover:bg-violet-700"
                        onClick={() => handleBuy(item)}
                        disabled={buyingId === item.id || gems < item.price_gems}
                      >
                        <ShoppingBag className="w-4 h-4 mr-1" />
                        <Gem className="w-3 h-3 mr-1" />
                        {item.price_gems}
                      </Button>
                    )}
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
