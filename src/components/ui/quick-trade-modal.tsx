'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Button } from './button'
import { Input } from './input'
import { createClientBrowser } from '@/lib/supabase/client'
import { notifyTradeComplete } from '@/lib/notify-trade'
import { toast } from 'sonner'
import { TradeAlert } from './trade-alert'
import { X } from 'lucide-react'

interface QuickTradeModalProps {
  isOpen: boolean
  onClose: () => void
  company: any
  user: any
  points: number
  holding: any
  onTradeComplete: (type: 'buy' | 'sell') => void
}

const isMarketOpen = () => {
  const hour = new Date().getHours()
  return hour >= 9 && hour < 24
}

type ConditionType = 'price_below' | 'price_above' | 'profit_rate'
type ExpiresIn = 0 | 3 | 7

const EXPIRES_LABELS: Record<ExpiresIn, string> = {
  0: '당일',
  3: '3일',
  7: '7일',
}

export function QuickTradeModal({
  isOpen,
  onClose,
  company,
  user,
  points,
  holding,
  onTradeComplete
}: QuickTradeModalProps) {
  if (company?.is_delisted) {
    return (
      <AnimatePresence>
        {isOpen && (
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-[100]"
              onClick={onClose}
            />
            <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="bg-gray-900 rounded-2xl p-8 shadow-2xl w-[90%] max-w-[360px]
                           border border-gray-800 pointer-events-auto"
              >
                <div className="flex flex-col items-center gap-5">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-white">거래 불가</h2>
                    <p className="text-gray-400">
                      이 기업은 상장폐지 상태입니다. 거래가 불가능합니다.
                    </p>
                  </div>
                  <Button onClick={onClose}>
                    닫기
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    )
  }

  const [mode, setMode] = useState<'instant' | 'conditional'>('instant')
  const [type, setType] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showAlert, setShowAlert] = useState(false)

  // 조건 주문 상태
  const [conditionType, setConditionType] = useState<ConditionType>('price_below')
  const [targetValue, setTargetValue] = useState('')
  const [expiresIn, setExpiresIn] = useState<ExpiresIn>(0)
  
  const supabase = createClientBrowser()
  if (!supabase) throw new Error('Could not create Supabase client')

  const totalAmount = Number(shares) * company.current_price
  const canBuy = points >= totalAmount && Number(shares) > 0
  const canSell = holding?.shares >= Number(shares) && Number(shares) > 0

  const maxBuyShares = Math.floor(points / company.current_price)
  const maxShares = type === 'buy' ? maxBuyShares : (holding?.shares || 0)

  // 조건 주문용 최대 매수 가능 수량 (목표가 기준)
  const condTargetPrice = Number(targetValue) || 0
  const condMaxBuyShares = condTargetPrice > 0 ? Math.floor(points / condTargetPrice) : 0
  const condMaxShares = type === 'buy' ? condMaxBuyShares : (holding?.shares || 0)
  const condEscrowAmount = type === 'buy' ? condTargetPrice * Number(shares) : 0
  const condCanSubmit = Number(shares) > 0 && condTargetPrice > 0 && 
    (type === 'buy' ? points >= condEscrowAmount : (holding?.shares || 0) >= Number(shares))

  const handleSharesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const numValue = Number(value)
    const max = mode === 'conditional' ? condMaxShares : maxShares
    
    if (numValue > max) {
      setShares(String(max))
    } else {
      setShares(value)
    }
  }

  const setSharesPercent = (pct: number) => {
    const max = mode === 'conditional' ? condMaxShares : maxShares
    setShares(String(Math.floor(max * pct)))
  }

  // 매수/매도 전환 시 조건 유형 자동 조정
  const handleTypeChange = (newType: 'buy' | 'sell') => {
    setType(newType)
    setShares('')
    if (mode === 'conditional') {
      if (newType === 'buy') {
        setConditionType('price_below')
      } else {
        setConditionType('price_above')
      }
    }
  }

  // 즉시 거래
  const handleTrade = async () => {
    if (!isMarketOpen()) {
      toast.error('현재 장 마감 시간입니다. 거래가 불가능합니다.')
      return
    }

    setIsLoading(true)
    
    try {
      if (type === 'buy' && !canBuy) {
        throw new Error('포인트가 부족합니다.')
      }
      
      if (type === 'sell' && !canSell) {
        throw new Error('보유 주식이 부족합니다.')
      }

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          company_id: company.id,
          transaction_type: type,
          shares: Number(shares),
          price: company.current_price,
          total_amount: totalAmount
        })

      if (transactionError) throw transactionError

      // 업적·미션 진행도 갱신
      const isProfitSell =
        type === 'sell' &&
        holding?.average_cost != null &&
        company.current_price > holding.average_cost
      await notifyTradeComplete(type, totalAmount, isProfitSell)

      onTradeComplete(type)
      setShowAlert(true)
      setTimeout(() => {
        setShowAlert(false)
        onClose()
      }, 1500)
      
      setShares('')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 조건 주문 등록
  const handleConditionalOrder = async () => {
    setIsLoading(true)

    try {
      const res = await fetch('/api/stock/pending-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          company_id: company.id,
          order_type: type,
          condition_type: conditionType,
          target_value: Number(targetValue),
          shares: Number(shares),
          expires_in_days: expiresIn,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '주문 등록에 실패했습니다.')
      }

      toast.success('조건 주문이 등록되었습니다.')
      onTradeComplete(type)
      setShares('')
      setTargetValue('')
      setTimeout(() => onClose(), 800)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <TradeAlert 
        isOpen={showAlert} 
        type={type} 
        onClose={() => setShowAlert(false)} 
      />
      <AnimatePresence>
        {isOpen && (
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-[100]"
              onClick={onClose}
            />
            <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                className="bg-gray-900 rounded-2xl shadow-2xl w-[92%] max-w-[400px] 
                           border border-gray-800 backdrop-blur-xl pointer-events-auto"
              >
                <div className="px-5 pt-5 pb-5 space-y-3">
                  {/* 종목명 + 닫기 */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-bold text-white leading-tight">{company.name}</h2>
                      <span className="text-xs text-gray-500">{company.ticker}</span>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 -mr-1.5 -mt-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 컴팩트 정보 바 */}
                  <div className="flex items-center rounded-lg bg-gray-800/30 py-2.5 px-1">
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-[10px] text-gray-500 mb-0.5">현재가</span>
                      <span className="text-[13px] font-semibold text-white tabular-nums">
                        {Math.floor(company.current_price).toLocaleString()}
                        <span className="text-[10px] text-gray-500 font-normal ml-0.5">원</span>
                      </span>
                    </div>
                    <div className="w-px h-7 bg-gray-700/40" />
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-[10px] text-gray-500 mb-0.5">보유</span>
                      <span className="text-[13px] font-semibold text-white tabular-nums">
                        {(holding?.shares || 0).toLocaleString()}
                        <span className="text-[10px] text-gray-500 font-normal ml-0.5">주</span>
                      </span>
                    </div>
                    <div className="w-px h-7 bg-gray-700/40" />
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-[10px] text-gray-500 mb-0.5">포인트</span>
                      <span className="text-[13px] font-semibold text-white tabular-nums">
                        {points.toLocaleString()}
                        <span className="text-[10px] text-gray-500 font-normal ml-0.5">P</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-gray-800/60" />

                  {/* 모드 탭 */}
                  <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg">
                    <button
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        mode === 'instant'
                          ? 'bg-gray-700 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                      onClick={() => { setMode('instant'); setShares('') }}
                    >
                      즉시 거래
                    </button>
                    <button
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        mode === 'conditional'
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                      onClick={() => { setMode('conditional'); setShares(''); setTargetValue('') }}
                    >
                      조건 주문
                    </button>
                  </div>

                  {/* 매수 / 매도 */}
                  <div className="flex gap-2">
                    <Button
                      variant={type === 'buy' ? 'default' : 'outline'}
                      className={type === 'buy' 
                        ? 'flex-1 bg-blue-500 hover:bg-blue-600' 
                        : 'flex-1 border-gray-700 text-gray-300 hover:text-white'
                      }
                      onClick={() => handleTypeChange('buy')}
                    >
                      매수
                    </Button>
                    <Button
                      variant={type === 'sell' ? 'default' : 'outline'}
                      className={type === 'sell'
                        ? 'flex-1 bg-red-500 hover:bg-red-600'
                        : 'flex-1 border-gray-700 text-gray-300 hover:text-white'
                      }
                      onClick={() => handleTypeChange('sell')}
                    >
                      매도
                    </Button>
                  </div>

                  {/* ─── 조건 주문 설정 카드 (애니메이션) ─── */}
                  <AnimatePresence initial={false}>
                    {mode === 'conditional' && (
                      <motion.div
                        key="conditional-section"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="p-3.5 rounded-xl bg-violet-500/[0.06] border border-violet-500/10 space-y-3">
                          {/* 조건 유형 */}
                          {type === 'buy' ? (
                            <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-violet-600/15 border border-violet-500/20">
                              <span className="text-xs font-medium text-violet-300">가격 이하 도달 시 매수</span>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <button
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                  conditionType === 'price_above'
                                    ? 'bg-violet-600/20 border border-violet-500/40 text-violet-300'
                                    : 'bg-gray-800/60 border border-gray-700/40 text-gray-500 hover:text-gray-300'
                                }`}
                                onClick={() => setConditionType('price_above')}
                              >
                                목표가 매도
                              </button>
                              <button
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                  conditionType === 'profit_rate'
                                    ? 'bg-violet-600/20 border border-violet-500/40 text-violet-300'
                                    : 'bg-gray-800/60 border border-gray-700/40 text-gray-500 hover:text-gray-300'
                                }`}
                                onClick={() => setConditionType('profit_rate')}
                              >
                                수익률 매도
                              </button>
                            </div>
                          )}

                          {/* 목표값 입력 */}
                          <div>
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                step={conditionType === 'profit_rate' ? '0.1' : '1'}
                                value={targetValue}
                                onChange={(e) => { setTargetValue(e.target.value); setShares('') }}
                                className="bg-black/20 border-gray-700/50 text-white placeholder-gray-600
                                         focus:border-violet-500 focus:ring-1 focus:ring-violet-500 pr-10 h-9 text-sm"
                                placeholder={conditionType === 'profit_rate' ? '목표 수익률' : '목표 가격'}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                {conditionType === 'profit_rate' ? '%' : '원'}
                              </span>
                            </div>
                            {conditionType !== 'profit_rate' && condTargetPrice > 0 && (
                              <p className="mt-1 text-[11px] text-gray-500">
                                현재가 대비
                                <span className={condTargetPrice < company.current_price ? ' text-blue-400' : ' text-red-400'}>
                                  {' '}{((condTargetPrice - company.current_price) / company.current_price * 100).toFixed(1)}%
                                </span>
                              </p>
                            )}
                          </div>

                          {/* 유효기간 - 인라인 */}
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-xs text-gray-500">유효기간</span>
                            <div className="flex gap-0.5 p-0.5 bg-gray-800/40 rounded-md">
                              {([0, 3, 7] as ExpiresIn[]).map((days) => (
                                <button
                                  key={days}
                                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                                    expiresIn === days
                                      ? 'bg-violet-600/30 text-violet-300 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-300'
                                  }`}
                                  onClick={() => setExpiresIn(days)}
                                >
                                  {EXPIRES_LABELS[days]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 수량 입력 */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm text-gray-400">수량</p>
                      <div className="flex gap-1">
                        {[
                          { label: '10%', pct: 0.1 },
                          { label: '25%', pct: 0.25 },
                          { label: '50%', pct: 0.5 },
                          { label: '전량', pct: 1 },
                        ].map(({ label, pct }) => (
                          <button
                            key={label}
                            className="h-6 px-2 text-[11px] rounded-md border border-gray-700/50 text-gray-500 hover:text-white hover:border-gray-500 transition-colors"
                            onClick={() => setSharesPercent(pct)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      max={mode === 'conditional' ? condMaxShares : maxShares}
                      value={shares}
                      onChange={handleSharesChange}
                      className="bg-black/30 border-gray-700 text-white placeholder-gray-500
                               focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="거래할 수량을 입력하세요"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {type === 'buy'
                        ? mode === 'conditional'
                          ? `최대 ${condMaxBuyShares.toLocaleString()}주 (목표가 기준)`
                          : `최대 ${maxBuyShares.toLocaleString()}주`
                        : `보유 ${(holding?.shares || 0).toLocaleString()}주`}
                    </p>
                  </div>

                  {/* ─── 실행 버튼 ─── */}
                  {mode === 'instant' ? (
                    <Button
                      className={`w-full h-12 text-sm font-semibold rounded-xl transition-all active:scale-[0.98] ${
                        type === 'buy' 
                          ? 'bg-blue-500 hover:bg-blue-600'
                          : 'bg-red-500 hover:bg-red-600'
                      }`}
                      disabled={(type === 'buy' ? !canBuy : !canSell) || isLoading || !isMarketOpen()}
                      onClick={handleTrade}
                    >
                      {!isMarketOpen() ? (
                        <span className="text-white/70">장 마감</span>
                      ) : isLoading ? (
                        '처리 중...'
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <span>{type === 'buy' ? '매수하기' : '매도하기'}</span>
                          {Number(shares) > 0 && (
                            <>
                              <span className="w-px h-4 bg-white/20" />
                              <span className="font-normal opacity-90">
                                {Math.floor(totalAmount).toLocaleString()}원
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full h-12 text-sm font-semibold rounded-xl bg-violet-600 hover:bg-violet-700 transition-all active:scale-[0.98]"
                      disabled={!condCanSubmit || isLoading}
                      onClick={handleConditionalOrder}
                    >
                      {isLoading ? '등록 중...' : (
                        <span className="flex items-center justify-center gap-2">
                          <span>조건 주문 등록</span>
                          {type === 'buy' && condEscrowAmount > 0 && (
                            <>
                              <span className="w-px h-4 bg-white/20" />
                              <span className="font-normal opacity-90">
                                {Math.floor(condEscrowAmount).toLocaleString()}원
                              </span>
                            </>
                          )}
                          {type === 'sell' && Number(shares) > 0 && (
                            <>
                              <span className="w-px h-4 bg-white/20" />
                              <span className="font-normal opacity-90">
                                {Number(shares).toLocaleString()}주
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
