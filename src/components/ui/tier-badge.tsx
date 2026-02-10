'use client'

const tierConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  bronze: { label: '브론즈', color: 'text-amber-700', bg: 'bg-amber-900/30', border: 'border-amber-700/50' },
  silver: { label: '실버', color: 'text-gray-300', bg: 'bg-gray-700/30', border: 'border-gray-500/50' },
  gold: { label: '골드', color: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-600/50' },
  platinum: { label: '플래티넘', color: 'text-cyan-300', bg: 'bg-cyan-900/30', border: 'border-cyan-600/50' },
  diamond: { label: '다이아', color: 'text-blue-300', bg: 'bg-blue-900/30', border: 'border-blue-500/50' },
  master: { label: '마스터', color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-500/50' },
  grandmaster: { label: '그랜드마스터', color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-500/50' },
}

const divisionLabels: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' }

interface TierBadgeProps {
  tier: string
  division?: number
  size?: 'sm' | 'md' | 'lg'
  showDivision?: boolean
}

export function TierBadge({ tier, division = 3, size = 'sm', showDivision = true }: TierBadgeProps) {
  const config = tierConfig[tier] || tierConfig.bronze
  const hasDivision = showDivision && tier !== 'master' && tier !== 'grandmaster'

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-md font-bold border
        ${config.color} ${config.bg} ${config.border}
        ${sizeClasses[size]}
      `}
    >
      {config.label}
      {hasDivision && <span className="opacity-70">{divisionLabels[division]}</span>}
    </span>
  )
}
