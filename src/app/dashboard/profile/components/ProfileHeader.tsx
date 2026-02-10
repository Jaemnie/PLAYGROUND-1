'use client'

import { UserCircle } from 'lucide-react'
import { TierBadge } from '@/components/ui/tier-badge'
import {
  Trophy, Star, Crown, Gem, HelpCircle, Flame, Award, Zap,
  HandCoins, TrendingUp, ThumbsUp, Target, Banknote, ShoppingCart,
  PieChart, Layers, Coins, Boxes, Compass, LayoutGrid,
  UserPlus, Users, UserCheck, MessageCircle, MessageSquare, MessagesSquare,
  Map, Newspaper, BookOpen, Calendar, CalendarCheck,
  ShoppingBag, TrendingDown, Shield, RotateCcw, Swords,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, Star, Crown, Gem, HelpCircle, Flame, Award, Zap,
  HandCoins, TrendingUp, ThumbsUp, Target, Banknote, ShoppingCart,
  PieChart, Layers, Coins, Boxes, Compass, LayoutGrid,
  UserPlus, Users, UserCheck, MessageCircle, MessageSquare, MessagesSquare,
  Map, Newspaper, BookOpen, Calendar, CalendarCheck,
  ShoppingBag, TrendingDown, Shield, RotateCcw, Swords,
  Fire: Flame, Milestone: Award,
}

const rarityColors: Record<string, string> = {
  common: 'text-zinc-300',
  rare: 'text-blue-300',
  epic: 'text-purple-300',
  legendary: 'text-amber-300',
}

interface ShopItem {
  code: string
  category: string
  preview_data: { color?: string; gradient?: string; icon?: string } | null
}

interface ProfileHeaderProps {
  nickname: string
  equippedTitle: { name: string; rarity: string } | null
  equippedFrame: string | null
  nicknameColor: string | null
  equippedBadge: string | null
  tier: string
  division?: number
  shopItems: ShopItem[]
}

function getNicknameStyle(
  code: string | null,
  shopItems: ShopItem[]
): React.CSSProperties {
  if (!code) return {}
  const item = shopItems.find((i) => i.code === code)
  if (!item?.preview_data) return {}
  const pd = item.preview_data
  if (pd.gradient) return { background: pd.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
  if (pd.color) return { color: pd.color }
  return {}
}

function getFrameStyle(code: string | null, shopItems: ShopItem[]): React.CSSProperties {
  if (!code) return {}
  const item = shopItems.find((i) => i.code === code)
  if (!item?.preview_data?.color) return {}
  return { borderColor: item.preview_data.color, boxShadow: `0 0 12px ${item.preview_data.color}40` }
}

export function ProfileHeader({
  nickname,
  equippedTitle,
  equippedFrame,
  nicknameColor,
  equippedBadge,
  tier,
  division = 3,
  shopItems,
}: ProfileHeaderProps) {
  const nicknameStyle = getNicknameStyle(nicknameColor, shopItems)
  const frameStyle = getFrameStyle(equippedFrame, shopItems)
  const BadgeIcon = equippedBadge
    ? iconMap[(shopItems.find((i) => i.code === equippedBadge)?.preview_data as { icon?: string })?.icon || ''] || Star
    : null

  const hasFrame = Object.keys(frameStyle).length > 0

  return (
    <div className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 p-6 md:p-8">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* 아바타 + 프레임 */}
        <div
          className={`relative shrink-0 flex items-center justify-center rounded-full p-1 ${hasFrame ? 'border-2' : ''}`}
          style={hasFrame ? frameStyle : undefined}
        >
          <div
            className={`
              flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full
              bg-zinc-800/80 border border-gray-700
            `}
          >
            <UserCircle className="w-12 h-12 md:w-14 md:h-14 text-gray-500" />
          </div>
          {BadgeIcon && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-900 border border-gray-700 flex items-center justify-center">
              <BadgeIcon className="w-4 h-4 text-amber-400" />
            </div>
          )}
        </div>

        {/* 닉네임, 칭호, 랭크 */}
        <div className="flex-1 text-center sm:text-left">
          {equippedTitle && (
            <p className={`text-sm font-medium mb-0.5 ${rarityColors[equippedTitle.rarity] || 'text-zinc-400'}`}>
              [{equippedTitle.name}]
            </p>
          )}
          <h1
            className="text-2xl md:text-3xl font-bold text-gray-100 break-all"
            style={Object.keys(nicknameStyle).length ? nicknameStyle : undefined}
          >
            {nickname || '이름 없음'}
          </h1>
          <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
            <TierBadge tier={tier} division={division} size="md" />
          </div>
        </div>
      </div>
    </div>
  )
}
