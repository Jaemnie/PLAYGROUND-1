'use client'

import { useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClientBrowser } from '@/lib/supabase/client'
import { TradeAlert } from '@/components/ui/trade-alert'

interface User {
  id: string;
  name: string;
  // 필요한 추가 필드들
}

interface Company {
  id: string;
  name: string;
  ticker: string;
  current_price: number;
  is_delisted?: boolean; // 상장폐지 여부
  // 필요한 추가 필드들
}

interface Holding {
  shares: number;
  // 필요한 추가 필드들
}

interface TradingFormProps {
  user: User;
  company: Company;
  holding: Holding | null;
  points: number;
  onTradeComplete: (type: 'buy' | 'sell') => void;
}

// isMarketOpen 함수 추가
const isMarketOpen = () => {
  const hour = new Date().getHours()
  return hour >= 9 && hour < 24
}

export function TradingForm({ 
  user, 
  company, 
  holding,
  points,
  onTradeComplete
}: TradingFormProps) {
  const [type, setType] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  
  const supabase = createClientBrowser()
  if (!supabase) throw new Error('Could not create Supabase client')

  const totalAmount = Number(shares) * company.current_price
  const canBuy = points >= totalAmount && Number(shares) > 0
  const canSell = holding ? holding.shares >= Number(shares) && Number(shares) > 0 : false

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

  const handleTrade = async (): Promise<void> => {
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
      
      setShares('')
    } catch (error: unknown) {
      console.error('거래 오류:', error instanceof Error ? error.message : '알 수 없는 오류')
    } finally {
      setIsLoading(false)
    }
  }

  // 상장폐지 또는 장 마감 상태 체크
  if (company?.is_delisted || !isMarketOpen()) {
    return (
      <>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-100">거래 불가</h2>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">
            {company?.is_delisted 
              ? '이 기업은 상장폐지 상태이므로 거래할 수 없습니다.'
              : '현재 장 마감 시간이므로 거래할 수 없습니다.'}
          </p>
        </CardContent>
      </>
    )
  }

  return (
    <>
      <TradeAlert 
        isOpen={showAlert} 
        type={type} 
        onClose={() => setShowAlert(false)} 
      />
      <CardHeader>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">주식 거래</h2>
          <div className="text-sm text-gray-400">
            {company.name} ({company.ticker})
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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
      </CardContent>
    </>
  )
} 