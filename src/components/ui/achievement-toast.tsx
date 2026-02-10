'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Star, Crown, Gem } from 'lucide-react'

interface AchievementToastProps {
  name: string
  rarity: string
  gems: number
  isVisible: boolean
  onClose: () => void
}

const rarityConfig = {
  common: {
    bg: 'from-zinc-800/90 to-zinc-900/90',
    border: 'border-zinc-600/50',
    text: 'text-zinc-300',
    icon: Star,
    label: '일반',
    glow: '',
  },
  rare: {
    bg: 'from-blue-900/90 to-blue-950/90',
    border: 'border-blue-500/50',
    text: 'text-blue-300',
    icon: Star,
    label: '레어',
    glow: 'shadow-blue-500/20',
  },
  epic: {
    bg: 'from-purple-900/90 to-purple-950/90',
    border: 'border-purple-500/50',
    text: 'text-purple-300',
    icon: Trophy,
    label: '에픽',
    glow: 'shadow-purple-500/20',
  },
  legendary: {
    bg: 'from-amber-900/90 to-amber-950/90',
    border: 'border-amber-500/50',
    text: 'text-amber-300',
    icon: Crown,
    label: '전설',
    glow: 'shadow-amber-500/30',
  },
}

export function AchievementToast({ name, rarity, gems, isVisible, onClose }: AchievementToastProps) {
  const config = rarityConfig[rarity as keyof typeof rarityConfig] || rarityConfig.common
  const IconComponent = config.icon

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -80, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100]"
          onClick={onClose}
        >
          <div
            className={`
              relative overflow-hidden rounded-2xl border backdrop-blur-xl
              bg-gradient-to-r ${config.bg} ${config.border}
              px-6 py-4 shadow-2xl ${config.glow}
              cursor-pointer min-w-[320px] max-w-[420px]
            `}
          >
            {/* 배경 파티클 효과 */}
            {rarity !== 'common' && (
              <motion.div
                className="absolute inset-0 opacity-20"
                animate={{
                  background: [
                    'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                    'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                    'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            )}

            <div className="relative flex items-center gap-4">
              {/* 아이콘 */}
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className={`
                  flex items-center justify-center w-12 h-12 rounded-xl
                  bg-white/10 backdrop-blur-sm
                `}
              >
                <IconComponent className={`w-6 h-6 ${config.text}`} />
              </motion.div>

              {/* 텍스트 */}
              <div className="flex-1">
                <motion.p
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-xs font-bold tracking-widest text-gray-400 uppercase"
                >
                  업적 달성!
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`text-lg font-bold ${config.text}`}
                >
                  {name}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-2 mt-0.5"
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-white/10 ${config.text}`}>
                    {config.label}
                  </span>
                  {gems > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-300">
                      <Gem className="w-3 h-3" />
                      +{gems}
                    </span>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
