'use client'

import { useEffect, useState } from 'react'
import { ClockIcon, ChartBarIcon, NewspaperIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'

interface AnimatedLabelProps {
  show: boolean;
  type: 'price' | 'news' | 'market';
}

const colors = {
  price: 'text-green-400',
  news: 'text-yellow-400',
  market: 'text-blue-400'
} as const;

function AnimatedLabel({ show, type }: AnimatedLabelProps) {
  const labels = {
    price: '주가',
    news: '뉴스',
    market: '시장'
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10, rotateX: -90 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, y: -10, rotateX: 90 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className={`absolute -top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-bold ${colors[type]} bg-black/50 backdrop-blur-sm whitespace-nowrap shadow-lg`}
        >
          {labels[type]} 변동!
          <motion.div 
            className="absolute inset-0 rounded bg-current opacity-10"
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type IconType = {
  price: typeof ChartBarIcon;
  news: typeof NewspaperIcon;
  market: typeof BuildingOfficeIcon;
};

const IconMap: IconType = {
  price: ChartBarIcon,
  news: NewspaperIcon,
  market: BuildingOfficeIcon
};

export function MarketTimer() {
  const [nextPriceUpdate, setNextPriceUpdate] = useState<Date | null>(null)
  const [nextNewsUpdate, setNextNewsUpdate] = useState<Date | null>(null)
  const [nextMarketUpdate, setNextMarketUpdate] = useState<Date | null>(null)
  const [flashPrice, setFlashPrice] = useState(false)
  const [flashNews, setFlashNews] = useState(false)
  const [flashMarket, setFlashMarket] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 100)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      
      // 다음 주가 업데이트 시간 계산 (1분 간격)
      const nextPrice = new Date(now)
      nextPrice.setMilliseconds(0)
      nextPrice.setSeconds(0)
      nextPrice.setMinutes(nextPrice.getMinutes() + 1)
      setNextPriceUpdate(nextPrice)
      
      // 다음 뉴스 업데이트 시간 계산 (30분 간격)
      const nextNews = new Date(now)
      nextNews.setMinutes(Math.ceil(nextNews.getMinutes() / 30) * 30)
      nextNews.setSeconds(0)
      setNextNewsUpdate(nextNews)
      
      // 다음 시장 업데이트 시간 계산 (1시간 간격)
      const nextMarket = new Date(now)
      nextMarket.setHours(nextMarket.getHours() + 1)
      nextMarket.setMinutes(0)
      nextMarket.setSeconds(0)
      setNextMarketUpdate(nextMarket)

      // 반짝임 효과 체크 - 더 정확한 시간 비교
      const timeUntilPrice = nextPrice.getTime() - now.getTime()
      const timeUntilNews = nextNews.getTime() - now.getTime()
      const timeUntilMarket = nextMarket.getTime() - now.getTime()

      // 뉴스나 시장 업데이트 발생 시 즉시 주가 업데이트
      if ((timeUntilNews <= 1000 && timeUntilNews > 0) || 
          (timeUntilMarket <= 1000 && timeUntilMarket > 0)) {
        if (timeUntilNews <= 1000 && timeUntilNews > 0) {
          setFlashNews(true)
        }
        if (timeUntilMarket <= 1000 && timeUntilMarket > 0) {
          setFlashMarket(true)
        }
        // 주가 업데이트는 뉴스/시장 업데이트와 동시에 발생
        setFlashPrice(true)
      } else if (timeUntilPrice <= 1000 && timeUntilPrice > 0) {
        // 일반 주가 업데이트 체크
        setFlashPrice(true)
      }
    }, 100)

    return () => clearInterval(timer)
  }, [])

  // 플래시 효과 리셋 로직 통합
  useEffect(() => {
    const resetFlash = (flash: boolean, setFlash: (value: boolean) => void) => {
      if (flash) {
        const timer = setTimeout(() => setFlash(false), 1000)
        return () => clearTimeout(timer)
      }
    }

    resetFlash(flashPrice, setFlashPrice)
    resetFlash(flashNews, setFlashNews)
    resetFlash(flashMarket, setFlashMarket)
  }, [flashPrice, flashNews, flashMarket])

  const getTimeRemaining = (targetDate: Date) => {
    const diff = targetDate.getTime() - currentTime.getTime()
    if (diff <= 0) return '0:00'
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const isMarketOpen = () => {
    const hour = new Date().getHours()
    return hour >= 9 && hour < 24
  }

  const type = 'price'
  const IconComponent = IconMap[type as keyof IconType]

  const nextUpdates = {
    price: nextPriceUpdate,
    news: nextNewsUpdate,
    market: nextMarketUpdate
  }

  return (
    <div className="grid grid-cols-4 gap-3 p-3 text-sm">
      {['price', 'news', 'market'].map((type, index) => {
        const currentFlash = {
          price: flashPrice,
          news: flashNews,
          market: flashMarket
        }[type] ?? false
        
        const IconComponent = IconMap[type as keyof IconType]

        return (
          <div key={type} className="relative">
            <AnimatedLabel show={currentFlash} type={type as any} />
            <motion.div 
              className="flex items-center gap-2 p-3 rounded-lg bg-black/20 border border-white/5 h-full cursor-pointer hover:bg-white/5 transition-colors"
              animate={{ 
                scale: currentFlash ? [1, 1.05, 1] : 1,
                rotateY: currentFlash ? [0, 5, -5, 0] : 0,
                background: currentFlash 
                  ? 'linear-gradient(45deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' 
                  : 'rgba(0,0,0,0.2)'
              }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.1,
                type: 'spring', 
                stiffness: 300 
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <IconComponent className={`w-4 h-4 ${colors[type as keyof typeof colors]}`} />
              <div>
                <div className="text-gray-400 capitalize">{type}</div>
                <div className="font-medium text-gray-100">
                  {nextUpdates[type as keyof typeof nextUpdates] 
                    ? getTimeRemaining(nextUpdates[type as keyof typeof nextUpdates]!) 
                    : '0:00'}
                </div>
              </div>
            </motion.div>
          </div>
        )
      })}
      
      <div className="flex items-center justify-center">
        <div className={`
          px-2 py-1 rounded-full text-xs font-medium
          ${isMarketOpen() ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
        `}>
          {isMarketOpen() ? '장 운영중' : '장 마감'}
        </div>
      </div>
    </div>
  )
} 