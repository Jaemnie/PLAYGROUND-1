'use client'

import { useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClientBrowser } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface TradingFormProps {
  user: any
  company: any
  holding: any
  points: number
}

export function TradingForm({ 
  user, 
  company, 
  holding,
  points 
}: TradingFormProps) {
  const [type, setType] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const supabase = createClientBrowser()

  const totalAmount = Number(shares) * company.current_price
  const canBuy = points >= totalAmount && Number(shares) > 0
  const canSell = holding?.shares >= Number(shares) && Number(shares) > 0

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

      toast.success(
        type === 'buy' 
          ? '매수가 완료되었습니다.' 
          : '매도가 완료되었습니다.'
      )
      
      setShares('')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
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
              {totalAmount.toLocaleString()}원
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