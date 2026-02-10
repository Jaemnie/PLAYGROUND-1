'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChartBarIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { CardHeader, CardContent } from '@/components/ui/card'
import { ClockIcon, UserIcon, BoltIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
import { useSession } from '@/lib/useSession'

interface MarketEvent {
  title: string
  sentiment: string
  impact: number
  affectedIndustries: string[]
  durationMinutes: number
  effectiveAt: string
}

type TrendDirection = 'bullish' | 'neutral' | 'bearish'

interface MarketInfo {
  marketPhase: 'bull' | 'neutral' | 'bear'
  activeEvents: MarketEvent[]
  sectorTrends: Record<string, TrendDirection>
}

const PHASE_CONFIG = {
  bull: { label: '호황', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30', dot: 'bg-green-400' },
  neutral: { label: '보합', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  bear: { label: '침체', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', dot: 'bg-red-400' },
} as const

const SENTIMENT_CONFIG = {
  positive: { icon: '▲', color: 'text-green-400' },
  negative: { icon: '▼', color: 'text-red-400' },
  neutral: { icon: '●', color: 'text-gray-400' },
} as const

export function MarketTimer() {
  const [isClient, setIsClient] = useState(false)
  const [nextPriceUpdate, setNextPriceUpdate] = useState<Date | null>(null)
  const [flashPrice, setFlashPrice] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showNumbers, setShowNumbers] = useState(true)
  const [serverOffset, setServerOffset] = useState<number>(0)
  const [activeUsers, setActiveUsers] = useState<number>(0)
  const [marketIsOpen, setMarketIsOpen] = useState(false)
  const [marketInfo, setMarketInfo] = useState<MarketInfo>({
    marketPhase: 'neutral',
    activeEvents: [],
    sectorTrends: {},
  })

  useSession()

  useEffect(() => { setIsClient(true) }, [])

  useEffect(() => {
    if (!isClient) return
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [isClient])

  useEffect(() => {
    if (!isClient) return
    const fetchServerTime = async () => {
      try {
        const res = await fetch('/api/server-time')
        const data = await res.json()
        setServerOffset(new Date(data.serverTime).getTime() - Date.now())
      } catch {
        setServerOffset(0)
      }
    }
    fetchServerTime()
  }, [isClient])

  useEffect(() => {
    if (!isClient) return
    const fetchActiveUsers = async () => {
      try {
        const res = await fetch('/api/active-users')
        const data = await res.json()
        if (data && typeof data.count === 'number') setActiveUsers(data.count)
      } catch { /* 기본값 유지 */ }
    }
    fetchActiveUsers()
    const timer = setInterval(fetchActiveUsers, 5000)
    return () => clearInterval(timer)
  }, [isClient])

  // 시장 정보 (시장 사이클 + 마켓 이벤트) 가져오기
  useEffect(() => {
    if (!isClient) return
    const fetchMarketInfo = async () => {
      try {
        const res = await fetch('/api/stock/market-info')
        const data = await res.json()
        if (data && !data.error) {
          setMarketInfo({
            marketPhase: data.marketPhase || 'neutral',
            activeEvents: data.activeEvents || [],
            sectorTrends: data.sectorTrends || {},
          })
        }
      } catch { /* 기본값 유지 */ }
    }
    fetchMarketInfo()
    const timer = setInterval(fetchMarketInfo, 30000) // 30초마다 갱신
    return () => clearInterval(timer)
  }, [isClient])

  const isMarketOpen = useCallback(() => {
    if (!isClient) return false
    const serverTime = new Date(Date.now() + serverOffset)
    const koreaHour = (serverTime.getUTCHours() + 9) % 24
    return koreaHour >= 9 && koreaHour < 24
  }, [isClient, serverOffset])

  useEffect(() => {
    if (!isClient) return
    setMarketIsOpen(isMarketOpen())
    const timer = setInterval(() => setMarketIsOpen(isMarketOpen()), 60000)
    return () => clearInterval(timer)
  }, [isClient, isMarketOpen])

  useEffect(() => {
    if (!isClient || !marketIsOpen) {
      setNextPriceUpdate(null)
      return
    }

    const timer = setInterval(() => {
      const now = new Date(Date.now() + serverOffset)
      const nextPrice = new Date(now)
      nextPrice.setMilliseconds(0)
      nextPrice.setSeconds(0)
      nextPrice.setMinutes(nextPrice.getMinutes() + 1)
      setNextPriceUpdate(nextPrice)

      const timeUntil = nextPrice.getTime() - now.getTime()
      if (timeUntil <= 1000 && timeUntil > 0) setFlashPrice(true)
    }, 1000)

    return () => clearInterval(timer)
  }, [isClient, marketIsOpen, serverOffset])

  useEffect(() => {
    if (!isClient || !flashPrice) return
    setShowNumbers(false)
    const t1 = setTimeout(() => setFlashPrice(false), 1000)
    const t2 = setTimeout(() => setShowNumbers(true), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isClient, flashPrice])

  const getTimeRemaining = (targetDate: Date) => {
    if (!isClient) return '0:00'
    const diff = targetDate.getTime() - new Date(currentTime.getTime() + serverOffset).getTime()
    if (diff <= 0) return '0:00'
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getEventTimeRemaining = (event: MarketEvent) => {
    const elapsed = (Date.now() - new Date(event.effectiveAt).getTime()) / (60 * 1000)
    const remaining = Math.max(0, event.durationMinutes - elapsed)
    if (remaining <= 0) return '만료'
    if (remaining < 60) return `${Math.ceil(remaining)}분`
    return `${Math.floor(remaining / 60)}시간 ${Math.ceil(remaining % 60)}분`
  }

  const phaseConfig = PHASE_CONFIG[marketInfo.marketPhase]

  // SSR 로딩 상태
  if (!isClient) {
    return (
      <>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              시장 현황
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="space-y-3">
              <div className="h-6 w-24 mx-auto rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-32 mx-auto rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-20 mx-auto rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        </CardContent>
      </>
    )
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
            시장 현황
          </h2>
        </motion.div>
      </CardHeader>
      <CardContent>
        {/* 상단: 주가 갱신 카운트다운 + 시장 사이클 배지 */}
        <div className="flex justify-center gap-3 w-full">
          {/* 주가 갱신 카운트다운 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative flex-1"
          >
            <motion.div
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-black/20 border border-white/5 backdrop-blur-sm"
              animate={{
                scale: flashPrice ? [1, 1.02, 1] : 1,
                background: flashPrice
                  ? ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.2)']
                  : 'rgba(0,0,0,0.2)',
              }}
              transition={{ duration: 0.6 }}
            >
              <ChartBarIcon className="w-5 h-5 text-blue-400" />
              <div className="text-gray-400 text-xs font-medium">다음 주가 갱신</div>
              <motion.div
                className="font-bold text-white text-lg tracking-tight"
                animate={flashPrice ? { scale: [1, 1.1, 1], color: ['#fff', '#3b82f6', '#fff'] } : {}}
                transition={{ duration: 0.4 }}
              >
                {!marketIsOpen
                  ? '장 마감'
                  : flashPrice && !showNumbers
                    ? '변동!'
                    : nextPriceUpdate
                      ? getTimeRemaining(nextPriceUpdate)
                      : '0:00'}
              </motion.div>
            </motion.div>
          </motion.div>

          {/* 시장 사이클 배지 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 30 }}
            className="relative flex-1"
          >
            <div className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${phaseConfig.bg} border ${phaseConfig.border} backdrop-blur-sm h-full justify-center`}>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className={`w-3 h-3 rounded-full ${phaseConfig.dot}`}
              />
              <div className="text-gray-400 text-xs font-medium">시장 분위기</div>
              <div className={`font-bold text-lg ${phaseConfig.color}`}>
                {phaseConfig.label}
              </div>
            </div>
          </motion.div>
        </div>

        {/* 장 운영 상태 + 접속자 수 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 border border-white/5">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className={`w-2 h-2 rounded-full ${marketIsOpen ? 'bg-blue-400' : 'bg-red-400'}`}
            />
            <span className={`text-sm font-medium ${marketIsOpen ? 'text-blue-400' : 'text-red-400'}`}>
              {marketIsOpen ? '장 운영중' : '장 마감'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <UserIcon className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-white/70">
              <span className="font-bold text-blue-400">{activeUsers.toLocaleString()}</span>
              <span className="ml-0.5 text-xs text-blue-400/70">명</span>
            </span>
          </div>
        </motion.div>

        {/* 활성 마켓 이벤트 */}
        <AnimatePresence>
          {marketInfo.activeEvents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-3 space-y-1.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <BoltIcon className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-medium text-yellow-400">활성 이벤트</span>
              </div>
              {marketInfo.activeEvents.slice(0, 3).map((event, i) => {
                const sentimentConfig = SENTIMENT_CONFIG[event.sentiment as keyof typeof SENTIMENT_CONFIG] || SENTIMENT_CONFIG.neutral
                return (
                  <motion.div
                    key={`${event.title}-${event.effectiveAt}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className={sentimentConfig.color}>{sentimentConfig.icon}</span>
                      <span className="text-gray-200 truncate">{event.title}</span>
                    </div>
                    <span className="text-gray-500 ml-2 flex-shrink-0">{getEventTimeRemaining(event)}</span>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 섹터 트렌드 뱃지 */}
        {Object.keys(marketInfo.sectorTrends).length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-3 pt-3 border-t border-white/5"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowTrendingUpIcon className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-medium text-gray-400">섹터 트렌드</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['테크', '반도체', '바이오', '엔터', '에너지', '금융', '패션', '푸드', '로봇', '건설', '모빌리티', '우주'] as const).map((industry) => {
                const direction = marketInfo.sectorTrends[industry] || 'neutral'
                const config = direction === 'bullish'
                  ? { icon: '▲', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' }
                  : direction === 'bearish'
                    ? { icon: '▼', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
                    : { icon: '─', color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10' }
                return (
                  <span
                    key={industry}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${config.bg} border ${config.border}`}
                  >
                    <span className={config.color}>{config.icon}</span>
                    <span className="text-gray-300">{industry}</span>
                  </span>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* 장 운영 안내 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-3 pt-3 border-t border-white/5"
        >
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>장 운영시간</span>
            <span className="font-medium text-gray-400">09:00 ~ 24:00</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
            <span>주가 갱신</span>
            <span className="font-medium text-gray-400">1분 간격</span>
          </div>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
            {marketInfo.marketPhase === 'bull'
              ? '호황기에는 상승 추세가 지속될 수 있지만 반전에 주의하세요.'
              : marketInfo.marketPhase === 'bear'
                ? '침체기에는 저가 매수 기회를 노려보세요.'
                : '보합장에서는 섹터 트렌드를 참고하여 선별 투자하세요.'}
          </p>
        </motion.div>
      </CardContent>
    </>
  )
}
