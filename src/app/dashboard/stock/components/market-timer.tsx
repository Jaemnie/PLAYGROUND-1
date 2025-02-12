'use client'

import { useEffect, useState } from 'react'
import { ChartBarIcon, NewspaperIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { CardHeader, CardContent } from '@/components/ui/card'
import { ClockIcon } from '@heroicons/react/24/outline'

interface AnimatedLabelProps {
  show: boolean;
  type: 'price' | 'news';
}

const colors = {
  price: 'text-blue-400',
  news: 'text-blue-400'
} as const;

function AnimatedLabel({ show, type }: AnimatedLabelProps) {
  const labels = {
    price: '주가',
    news: '뉴스'
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          transition={{ 
            type: "spring",
            stiffness: 400,
            damping: 30
          }}
          className={`absolute -top-4 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full text-[11px] font-bold ${colors[type]} bg-blue-500/20 border border-blue-500/30 backdrop-blur-sm whitespace-nowrap`}
        >
          {labels[type]} 변동!
          <motion.div 
            className="absolute inset-0 rounded-full bg-blue-400/20"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{ 
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type IconType = {
  price: typeof ChartBarIcon;
  news: typeof NewspaperIcon;
};

const IconMap: IconType = {
  price: ChartBarIcon,
  news: NewspaperIcon
};

export function MarketTimer() {
  const [nextPriceUpdate, setNextPriceUpdate] = useState<Date | null>(null)
  const [nextNewsUpdate, setNextNewsUpdate] = useState<Date | null>(null)
  const [flashPrice, setFlashPrice] = useState(false)
  const [flashNews, setFlashNews] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showNumbers, setShowNumbers] = useState(true)
  const [serverOffset, setServerOffset] = useState<number>(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 100)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchServerTime = async () => {
      try {
        const res = await fetch('/api/server-time')
        const data = await res.json()
        const serverDate = new Date(data.serverTime)
        setServerOffset(serverDate.getTime() - Date.now())
      } catch (error) {
        console.error('서버 시각 가져오기 실패:', error)
      }
    }
    fetchServerTime()
  }, [])

  useEffect(() => {
    // 장이 열려있을 때만 타이머 작동
    if (!isMarketOpen()) {
      setNextPriceUpdate(null)
      setNextNewsUpdate(null)
      return
    }

    const timer = setInterval(() => {
      const now = new Date()
      
      // 다음 주가 업데이트 시간 계산 (1분 간격)
      const nextPrice = new Date(now)
      nextPrice.setMilliseconds(0)
      nextPrice.setSeconds(0)
      nextPrice.setMinutes(nextPrice.getMinutes() + 1)
      
      // 다음 뉴스 업데이트 시간 계산 (30분 간격)
      const nextNews = new Date(now)
      nextNews.setSeconds(0)
      nextNews.setMilliseconds(0)
      const minutes = nextNews.getMinutes()

      if (minutes >= 30) {
        nextNews.setHours(nextNews.getHours() + 1)
        nextNews.setMinutes(0)
      } else if (minutes < 30) {
        nextNews.setMinutes(30)
      }

      setNextPriceUpdate(nextPrice)
      setNextNewsUpdate(nextNews)

      // 업데이트 시간 체크 및 플래시 효과
      const checkAndSetFlash = (targetTime: Date, setFlash: (value: boolean) => void) => {
        const timeUntil = targetTime.getTime() - now.getTime()
        if (timeUntil <= 1000 && timeUntil > 0) {
          setFlash(true)
        }
      }

      checkAndSetFlash(nextPrice, setFlashPrice)
      checkAndSetFlash(nextNews, setFlashNews)

    }, 100)

    return () => clearInterval(timer)
  }, [])

  // 플래시 효과 리셋 로직 통합
  useEffect(() => {
    const resetFlash = (flash: boolean, setFlash: (value: boolean) => void) => {
      if (flash) {
        setShowNumbers(false)
        const flashTimer = setTimeout(() => setFlash(false), 1000)
        const numberTimer = setTimeout(() => setShowNumbers(true), 1000)
        return () => {
          clearTimeout(flashTimer)
          clearTimeout(numberTimer)
        }
      }
    }

    resetFlash(flashPrice, setFlashPrice)
    resetFlash(flashNews, setFlashNews)
  }, [flashPrice, flashNews])

  const getTimeRemaining = (targetDate: Date) => {
    const diff = targetDate.getTime() - currentTime.getTime()
    if (diff <= 0) return '0:00'
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const isMarketOpen = () => {
    // 현재 클라이언트 시간에 서버 오프셋을 적용하여 서버 기준 시간을 계산
    const serverTime = new Date(new Date().getTime() + serverOffset);
    // 서버 타임스탬프를 UTC 기준으로 가져온 후, 한국 시간으로 보정 (UTC + 9)
    const koreaHour = (serverTime.getUTCHours() + 9) % 24;
    return koreaHour >= 9 && koreaHour < 24;
  }

  return (
    <>
      <CardHeader>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2"
        >
          <ClockIcon className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            시장 타이머
          </h2>
        </motion.div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center gap-4 w-full">
          {['price', 'news'].map((type, index) => {
            const currentFlash = {
              price: flashPrice,
              news: flashNews
            }[type as keyof typeof colors] ?? false
            
            const IconComponent = IconMap[type as keyof IconType]
            const nextUpdate = {
              price: nextPriceUpdate,
              news: nextNewsUpdate
            }[type as keyof typeof colors]

            return (
              <motion.div 
                key={type} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  delay: index * 0.1,
                  type: "spring",
                  stiffness: 400,
                  damping: 30
                }}
                className="relative flex-1"
              >
                <motion.div 
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-black/20 border border-white/5 backdrop-blur-sm"
                  animate={{ 
                    scale: currentFlash ? [1, 1.02, 1] : 1,
                    background: currentFlash 
                      ? ['rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.2)']
                      : 'rgba(0, 0, 0, 0.2)'
                  }}
                  transition={{ 
                    duration: 0.6,
                    ease: [0.32, 0.72, 0, 1]
                  }}
                >
                  <IconComponent className={`w-5 h-5 ${colors[type as keyof typeof colors]}`} />
                  <div className="text-center">
                    <div className="text-gray-400 text-xs font-medium mb-0.5">
                      {type === 'price' ? '다음 주가 갱신' : '다음 뉴스 갱신'}
                    </div>
                    <motion.div 
                      className="font-bold text-white text-lg tracking-tight"
                      animate={currentFlash ? {
                        scale: [1, 1.1, 1],
                        color: ['#ffffff', '#3b82f6', '#ffffff']
                      } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      {!isMarketOpen() 
                        ? '장 마감' 
                        : (currentFlash && !showNumbers ? '변동!' : (nextUpdate ? getTimeRemaining(nextUpdate) : '0:00'))}
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 flex items-center justify-center"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 border border-white/5">
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={`w-2 h-2 rounded-full ${isMarketOpen() ? 'bg-blue-400' : 'bg-red-400'}`} 
            />
            <span className={`text-sm font-medium ${isMarketOpen() ? 'text-blue-400' : 'text-red-400'}`}>
              {isMarketOpen() ? '장 운영중' : '장 마감'}
            </span>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-center"
        >
          <span className="text-sm text-white/70">
            현재 서버 시각:{' '}
            {new Date(currentTime.getTime() + serverOffset).toLocaleTimeString('ko-KR', { hour12: false })}
          </span>
        </motion.div>
      </CardContent>
    </>
  )
} 