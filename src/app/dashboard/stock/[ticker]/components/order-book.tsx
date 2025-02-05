'use client'

import { useEffect, useState } from 'react'
import { CardHeader, CardContent } from '@/components/ui/card'
import { createClientBrowser } from '@/lib/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Order {
  price: number
  volume: number
  totalVolume: number // 누적 거래량
}

interface OrderBookProps {
  company: any
}

export function OrderBook({ company }: OrderBookProps) {
  const [askOrders, setAskOrders] = useState<Order[]>([])
  const [bidOrders, setBidOrders] = useState<Order[]>([])

  useEffect(() => {
    if (company?.id) {
      const supabaseClient = createClientBrowser()
      const fetchTransactions = async () => {
        // 24시간 전 시간 계산
        const oneDayAgo = new Date()
        oneDayAgo.setHours(oneDayAgo.getHours() - 24)

        // 매도(ask) 거래 내역
        const { data: askData, error: askError } = await supabaseClient
          .from('transactions')
          .select('*')
          .eq('company_id', company.id)
          .eq('transaction_type', 'sell')
          .gte('created_at', oneDayAgo.toISOString())
          .order('price', { ascending: false }) // 가격 내림차순

        if (askError) {
          console.error('매도 거래 데이터 로딩 오류:', askError)
        } else {
          // 가격별로 그룹화하고 거래량 집계
          const groupedAsks = askData?.reduce((acc: { [key: number]: number }, tx) => {
            acc[tx.price] = (acc[tx.price] || 0) + tx.shares
            return acc
          }, {})

          // 누적 거래량 계산하여 정렬된 배열로 변환
          let totalVolume = 0
          const processedAsks = Object.entries(groupedAsks || {})
            .map(([price, volume]) => {
              totalVolume += volume
              return {
                price: Number(price),
                volume,
                totalVolume
              }
            })
            .slice(0, 10) // 상위 10개 호가만 표시

          setAskOrders(processedAsks)
        }

        // 매수(bid) 거래 내역
        const { data: bidData, error: bidError } = await supabaseClient
          .from('transactions')
          .select('*')
          .eq('company_id', company.id)
          .eq('transaction_type', 'buy')
          .gte('created_at', oneDayAgo.toISOString())
          .order('price', { ascending: false }) // 가격 내림차순

        if (bidError) {
          console.error('매수 거래 데이터 로딩 오류:', bidError)
        } else {
          // 가격별로 그룹화하고 거래량 집계
          const groupedBids = bidData?.reduce((acc: { [key: number]: number }, tx) => {
            acc[tx.price] = (acc[tx.price] || 0) + tx.shares
            return acc
          }, {})

          // 누적 거래량 계산하여 정렬된 배열로 변환
          let totalVolume = 0
          const processedBids = Object.entries(groupedBids || {})
            .map(([price, volume]) => {
              totalVolume += volume
              return {
                price: Number(price),
                volume,
                totalVolume
              }
            })
            .slice(0, 10) // 상위 10개 호가만 표시

          setBidOrders(processedBids)
        }
      }
      fetchTransactions()
    }
  }, [company])

  return (
    <>
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-100">호가창</h2>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* 매도 호가 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400 mb-3">매도 호가</h3>
            <div className="bg-black/30 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-gray-800">
                    <TableHead className="text-right">가격</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-right">누적</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {askOrders.length > 0 ? (
                    askOrders.map((order, index) => (
                      <TableRow 
                        key={index} 
                        className="hover:bg-gray-800/30 border-gray-800"
                      >
                        <TableCell className="text-right font-medium text-red-400">
                          {Math.floor(order.price).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-gray-300">
                          {order.volume.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-gray-400 text-sm">
                          {order.totalVolume.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell 
                        colSpan={3} 
                        className="text-center text-gray-500 py-4"
                      >
                        매도 호가 없음
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* 매수 호가 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400 mb-3">매수 호가</h3>
            <div className="bg-black/30 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-gray-800">
                    <TableHead className="text-right">가격</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-right">누적</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bidOrders.length > 0 ? (
                    bidOrders.map((order, index) => (
                      <TableRow 
                        key={index} 
                        className="hover:bg-gray-800/30 border-gray-800"
                      >
                        <TableCell className="text-right font-medium text-green-400">
                          {Math.floor(order.price).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-gray-300">
                          {order.volume.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-gray-400 text-sm">
                          {order.totalVolume.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell 
                        colSpan={3} 
                        className="text-center text-gray-500 py-4"
                      >
                        매수 호가 없음
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  )
} 