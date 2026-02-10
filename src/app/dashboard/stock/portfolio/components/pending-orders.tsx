'use client'

import { useState, useEffect, useCallback } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Company {
  id: string
  name: string
  ticker: string
  current_price: number
  last_closing_price: number
}

interface PendingOrder {
  id: string
  user_id: string
  company_id: string
  order_type: 'buy' | 'sell'
  condition_type: 'price_above' | 'price_below' | 'profit_rate'
  target_value: number
  shares: number
  escrowed_amount: number
  status: 'pending' | 'executed' | 'cancelled' | 'expired'
  expires_at: string
  created_at: string
  executed_at: string | null
  execution_price: number | null
  company: Company
}

interface PendingOrdersProps {
  userId: string
  onOrderChange?: () => void
}

const CONDITION_LABELS: Record<string, string> = {
  price_below: '가격 이하 매수',
  price_above: '가격 이상 매도',
  profit_rate: '수익률 매도',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '대기중', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  executed: { label: '체결됨', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: '취소됨', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  expired: { label: '만료됨', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return '만료됨'
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}일 ${hours % 24}시간`
  }
  return `${hours}시간 ${minutes}분`
}

export default function PendingOrders({ userId, onOrderChange }: PendingOrdersProps) {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending'>('pending')

  const fetchOrders = useCallback(async () => {
    try {
      const statusParam = filter === 'pending' ? '&status=pending' : ''
      const res = await fetch(`/api/stock/pending-orders?user_id=${userId}${statusParam}`)
      const data = await res.json()
      if (data.orders) {
        setOrders(data.orders)
      }
    } catch {
      console.error('조건 주문 목록 조회 실패')
    } finally {
      setIsLoading(false)
    }
  }, [userId, filter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId)
    try {
      const res = await fetch(`/api/stock/pending-orders/${orderId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '취소에 실패했습니다.')
      }

      toast.success('주문이 취소되었습니다.')
      fetchOrders()
      onOrderChange?.()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '주문 취소 중 오류가 발생했습니다.'
      toast.error(message)
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <>
      <CardHeader>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">조건 주문</h2>
          <div className="flex gap-1 p-0.5 bg-gray-800/60 rounded-lg">
            <button
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filter === 'pending'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              onClick={() => setFilter('pending')}
            >
              대기중
            </button>
            <button
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filter === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              onClick={() => setFilter('all')}
            >
              전체
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              {filter === 'pending' ? '대기 중인 조건 주문이 없습니다.' : '조건 주문 내역이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status]
              return (
                <div
                  key={order.id}
                  className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/50 space-y-3"
                >
                  {/* 상단: 종목명 + 상태 */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                        order.order_type === 'buy' 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {order.order_type === 'buy' ? '매수' : '매도'}
                      </span>
                      <span className="text-white font-medium">
                        {order.company.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {order.company.ticker}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* 중간: 조건 정보 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">조건</span>
                      <span className="text-gray-300 ml-2">{CONDITION_LABELS[order.condition_type]}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">목표</span>
                      <span className="text-gray-300 ml-2">
                        {order.condition_type === 'profit_rate'
                          ? `${order.target_value}%`
                          : `${Math.floor(order.target_value).toLocaleString()}원`}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">수량</span>
                      <span className="text-gray-300 ml-2">{order.shares.toLocaleString()}주</span>
                    </div>
                    <div>
                      <span className="text-gray-500">현재가</span>
                      <span className="text-gray-300 ml-2">{Math.floor(order.company.current_price).toLocaleString()}원</span>
                    </div>
                    {order.status === 'executed' && order.execution_price && (
                      <div className="col-span-2">
                        <span className="text-gray-500">체결가</span>
                        <span className="text-green-400 ml-2 font-medium">
                          {Math.floor(order.execution_price).toLocaleString()}원
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 하단: 잔여시간 + 취소 버튼 */}
                  <div className="flex justify-between items-center pt-1 border-t border-gray-700/30">
                    <span className="text-xs text-gray-500">
                      {order.status === 'pending'
                        ? `남은 시간: ${getTimeRemaining(order.expires_at)}`
                        : order.status === 'executed' && order.executed_at
                          ? `체결: ${new Date(order.executed_at).toLocaleString('ko-KR')}`
                          : `등록: ${new Date(order.created_at).toLocaleString('ko-KR')}`}
                    </span>
                    {order.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-xs border-gray-600 text-gray-400 hover:text-red-400 hover:border-red-500/50"
                        disabled={cancellingId === order.id}
                        onClick={() => handleCancel(order.id)}
                      >
                        {cancellingId === order.id ? '취소중...' : '주문 취소'}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </>
  )
}
