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

export function QuickTradeModal({
  isOpen,
  onClose,
  company,
  user,
  points,
  holding,
  onTradeComplete
}: QuickTradeModalProps) {
  const [type, setType] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  
  const supabase = createClientBrowser()

  const totalAmount = Number(shares) * company.current_price
  const canBuy = points >= totalAmount && Number(shares) > 0
  const canSell = holding?.shares >= Number(shares) && Number(shares) > 0

  const maxBuyShares = Math.floor(points / company.current_price)
  const maxShares = type === 'buy' ? maxBuyShares : (holding?.shares || 0)

  const handleSharesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const numValue = Number(value)
    
    if (numValue > maxShares) {
      setShares(String(maxShares))
    } else {
      setShares(value)
    }
  }

  const setMaxShares = () => {
    setShares(String(maxShares))
  }

  const setHalfShares = () => {
    setShares(String(Math.floor(maxShares / 2)))
  }

  const handleTrade = async () => {
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

  return (
    <>
      <TradeAlert 
        isOpen={showAlert} 
        type={type} 
        onClose={() => setShowAlert(false)} 
      />
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-[100]"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                        bg-gray-900/95 rounded-2xl p-6 shadow-2xl z-[101] w-[90%] 
                        max-w-[400px] border border-gray-800 backdrop-blur-xl"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white">퀵 트레이딩</h2>
                  <div className="text-sm text-gray-400">
                    {company.name} ({company.ticker})
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={type === 'buy' ? 'default' : 'outline'}
                    className={type === 'buy' 
                      ? 'flex-1 bg-blue-500 hover:bg-blue-600' 
                      : 'flex-1 border-gray-700 text-gray-300 hover:text-white'
                    }
                    onClick={() => setType('buy')}
                  >
                    매수
                  </Button>
                  <Button
                    variant={type === 'sell' ? 'default' : 'outline'}
                    className={type === 'sell'
                      ? 'flex-1 bg-red-500 hover:bg-red-600'
                      : 'flex-1 border-gray-700 text-gray-300 hover:text-white'
                    }
                    onClick={() => setType('sell')}
                  >
                    매도
                  </Button>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-400">수량</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs border-gray-700 text-gray-300 hover:text-white"
                        onClick={setHalfShares}
                      >
                        HALF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs border-gray-700 text-gray-300 hover:text-white"
                        onClick={setMaxShares}
                      >
                        ALL
                      </Button>
                    </div>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    max={maxShares}
                    value={shares}
                    onChange={handleSharesChange}
                    className="bg-black/30 border-gray-700 text-white placeholder-gray-500
                             focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="거래할 수량을 입력하세요"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    {type === 'buy' 
                      ? `최대 매수 가능: ${maxBuyShares.toLocaleString()}주`
                      : `보유 중: ${(holding?.shares || 0).toLocaleString()}주`}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-400 mb-2">총 거래금액</p>
                  <p className="text-xl font-bold text-white">
                    {Math.floor(totalAmount).toLocaleString()}원
                  </p>
                </div>

                <Button
                  className={`w-full ${
                    type === 'buy' 
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                  disabled={type === 'buy' ? !canBuy : !canSell || isLoading}
                  onClick={handleTrade}
                >
                  {type === 'buy' ? '매수하기' : '매도하기'}
                </Button>

                <p className="text-sm text-gray-400">
                  보유 포인트: {points.toLocaleString()}P
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
} 