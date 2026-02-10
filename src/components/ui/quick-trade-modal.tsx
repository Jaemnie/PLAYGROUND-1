'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Button } from './button'
import { Input } from './input'
import { createClientBrowser } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { TradeAlert } from './trade-alert'

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

const CONDITION_LABELS: Record<string, Record<ConditionType, string>> = {
  buy: {
    price_below: '가격 이하 도달 시 매수',
    price_above: '',
    profit_rate: '',
  },
  sell: {
    price_below: '',
    price_above: '가격 이상 도달 시 매도',
    profit_rate: '수익률 도달 시 매도',
  },
}

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

  const setMaxSharesBtn = () => {
    setShares(String(mode === 'conditional' ? condMaxShares : maxShares))
  }

  const setHalfSharesBtn = () => {
    const max = mode === 'conditional' ? condMaxShares : maxShares
    setShares(String(Math.floor(max / 2)))
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
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="bg-gray-900 rounded-2xl p-6 shadow-2xl w-[90%] 
                           max-w-[420px] border border-gray-800 backdrop-blur-xl pointer-events-auto"
              >
                <div className="space-y-4">
                  {/* 헤더 */}
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">
                      {mode === 'instant' ? '퀵 트레이딩' : '조건 주문'}
                    </h2>
                    <div className="text-sm text-gray-400">
                      {company.name} ({company.ticker})
                    </div>
                  </div>

                  {/* 모드 전환: 즉시 거래 / 조건 주문 */}
                  <div className="flex gap-1 p-1 bg-gray-800/60 rounded-lg">
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

                  {/* 매수 / 매도 선택 */}
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

                  {/* ===== 조건 주문 모드 ===== */}
                  {mode === 'conditional' && (
                    <>
                      {/* 조건 유형 선택 */}
                      <div>
                        <p className="text-sm text-gray-400 mb-2">조건 유형</p>
                        <div className="flex flex-col gap-1.5">
                          {type === 'buy' ? (
                            <button
                              className="w-full py-2 px-3 rounded-lg text-sm text-left bg-violet-600/20 border border-violet-500/50 text-violet-300"
                            >
                              가격 이하 도달 시 매수
                            </button>
                          ) : (
                            <>
                              <button
                                className={`w-full py-2 px-3 rounded-lg text-sm text-left transition-all ${
                                  conditionType === 'price_above'
                                    ? 'bg-violet-600/20 border border-violet-500/50 text-violet-300'
                                    : 'bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-gray-300'
                                }`}
                                onClick={() => setConditionType('price_above')}
                              >
                                가격 이상 도달 시 매도
                              </button>
                              <button
                                className={`w-full py-2 px-3 rounded-lg text-sm text-left transition-all ${
                                  conditionType === 'profit_rate'
                                    ? 'bg-violet-600/20 border border-violet-500/50 text-violet-300'
                                    : 'bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-gray-300'
                                }`}
                                onClick={() => setConditionType('profit_rate')}
                              >
                                수익률 도달 시 매도
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 목표값 입력 */}
                      <div>
                        <p className="text-sm text-gray-400 mb-2">
                          {conditionType === 'profit_rate' ? '목표 수익률 (%)' : '목표 가격'}
                        </p>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            step={conditionType === 'profit_rate' ? '0.1' : '1'}
                            value={targetValue}
                            onChange={(e) => { setTargetValue(e.target.value); setShares('') }}
                            className="bg-black/30 border-gray-700 text-white placeholder-gray-500
                                     focus:border-violet-500 focus:ring-1 focus:ring-violet-500 pr-10"
                            placeholder={conditionType === 'profit_rate' ? '예: 5' : `현재가: ${Math.floor(company.current_price).toLocaleString()}`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                            {conditionType === 'profit_rate' ? '%' : '원'}
                          </span>
                        </div>
                        {conditionType !== 'profit_rate' && (
                          <p className="mt-1 text-xs text-gray-500">
                            현재가: {Math.floor(company.current_price).toLocaleString()}원
                            {condTargetPrice > 0 && (
                              <span className={condTargetPrice < company.current_price ? ' text-blue-400' : ' text-red-400'}>
                                {' '}({((condTargetPrice - company.current_price) / company.current_price * 100).toFixed(1)}%)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* 수량 입력 */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm text-gray-400">수량</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs border-gray-700 text-gray-300 hover:text-white"
                          onClick={setHalfSharesBtn}
                        >
                          HALF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs border-gray-700 text-gray-300 hover:text-white"
                          onClick={setMaxSharesBtn}
                        >
                          ALL
                        </Button>
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
                    <p className="mt-1 text-xs text-gray-400">
                      {type === 'buy'
                        ? mode === 'conditional'
                          ? `최대 매수 가능: ${condMaxBuyShares.toLocaleString()}주 (목표가 기준)`
                          : `최대 매수 가능: ${maxBuyShares.toLocaleString()}주`
                        : `보유 중: ${(holding?.shares || 0).toLocaleString()}주`}
                    </p>
                  </div>

                  {/* 조건 주문: 유효기간 */}
                  {mode === 'conditional' && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">유효기간</p>
                      <div className="flex gap-2">
                        {([0, 3, 7] as ExpiresIn[]).map((days) => (
                          <button
                            key={days}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                              expiresIn === days
                                ? 'bg-violet-600/20 border border-violet-500/50 text-violet-300'
                                : 'bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-gray-300'
                            }`}
                            onClick={() => setExpiresIn(days)}
                          >
                            {EXPIRES_LABELS[days]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 거래 금액 / 에스크로 금액 */}
                  <div>
                    <p className="text-sm text-gray-400 mb-2">
                      {mode === 'conditional' ? (type === 'buy' ? '에스크로 금액 (잠김)' : '잠김 주식') : '총 거래금액'}
                    </p>
                    <p className="text-xl font-bold text-white">
                      {mode === 'conditional'
                        ? type === 'buy'
                          ? `${Math.floor(condEscrowAmount).toLocaleString()}원`
                          : `${Number(shares || 0).toLocaleString()}주`
                        : `${Math.floor(totalAmount).toLocaleString()}원`}
                    </p>
                  </div>

                  {/* 실행 버튼 */}
                  {mode === 'instant' ? (
                    <Button
                      className={`w-full ${
                        type === 'buy' 
                          ? 'bg-blue-500 hover:bg-blue-600'
                          : 'bg-red-500 hover:bg-red-600'
                      }`}
                      disabled={(type === 'buy' ? !canBuy : !canSell) || isLoading || !isMarketOpen()}
                      onClick={handleTrade}
                    >
                      {!isMarketOpen() ? '장 마감' : isLoading ? '처리 중...' : type === 'buy' ? '매수하기' : '매도하기'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700"
                      disabled={!condCanSubmit || isLoading}
                      onClick={handleConditionalOrder}
                    >
                      {isLoading ? '등록 중...' : '조건 주문 등록'}
                    </Button>
                  )}

                  <p className="text-sm text-gray-400">
                    보유 포인트: {points.toLocaleString()}P
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
