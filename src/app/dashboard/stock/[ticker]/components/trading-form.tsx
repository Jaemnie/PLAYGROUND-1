'use client'

import { useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClientBrowser } from '@/lib/supabase/client'
import { toast } from 'sonner'
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

export function TradingForm({ 
  user, 
  company, 
  holding,
  points,
  onTradeComplete
}: TradingFormProps) {
  // React Hook은 조건부가 아닌 최상위에서 항상 호출해야합니다.
  const [type, setType] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  
  const supabase = createClientBrowser()

  const totalAmount = Number(shares) * company.current_price
  const canBuy = points >= totalAmount && Number(shares) > 0
  const canSell = holding ? holding.shares >= Number(shares) && Number(shares) > 0 : false

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
      toast.success(
        type === 'buy' 
          ? '매수가 완료되었습니다.' 
          : '매도가 완료되었습니다.'
      )
      
      setShares('')
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('알 수 없는 오류가 발생했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 조건에 따라 다른 UI를 렌더링하도록 return 내부에서 조건부 분기합니다.
  if (company?.is_delisted) {
    return (
      <>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-100">거래 불가</h2>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">
            이 기업은 상장폐지 상태이므로 거래할 수 없습니다.
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
        <h2 className="text-xl font-semibold text-gray-100">주식 거래</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={type === 'buy' ? 'default' : 'outline'}
              className={type === 'buy' 
                ? 'flex-1 bg-blue-500 hover:bg-blue-600' 
                : 'flex-1 border-gray-700'
              }
              onClick={() => setType('buy')}
            >
              매수
            </Button>
            <Button
              variant={type === 'sell' ? 'default' : 'outline'}
              className={type === 'sell'
                ? 'flex-1 bg-red-500 hover:bg-red-600'
                : 'flex-1 border-gray-700'
              }
              onClick={() => setType('sell')}
            >
              매도
            </Button>
          </div>

          <div>
            <p className="text-sm text-gray-400 mb-2">수량</p>
            <Input
              type="number"
              min="1"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="bg-black/30 border-gray-700"
            />
          </div>

          <div>
            <p className="text-sm text-gray-400 mb-2">총 거래금액</p>
            <p className="text-xl font-bold text-gray-100">
              {Math.floor(totalAmount).toLocaleString()}원
            </p>
          </div>

          <Button
            className={type === 'buy' 
              ? 'w-full bg-blue-500 hover:bg-blue-600'
              : 'w-full bg-red-500 hover:bg-red-600'
            }
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