'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'

interface Transaction {
  id: string
  transaction_type: string
  shares: number
  price: number
  total_amount: number
  created_at: string
  company?: { name: string, ticker: string }
}

interface TransactionHistoryProps {
  transactions: Transaction[]
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">거래 내역</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead>
            <TableHead>종목명</TableHead>
            <TableHead>종목코드</TableHead>
            <TableHead>거래 유형</TableHead>
            <TableHead className="text-right">수량</TableHead>
            <TableHead className="text-right">가격</TableHead>
            <TableHead className="text-right">총 거래금액</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>{format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
              <TableCell>{tx.company?.name || '-'}</TableCell>
              <TableCell>{tx.company?.ticker || '-'}</TableCell>
              <TableCell>{tx.transaction_type === 'buy' ? '매수' : '매도'}</TableCell>
              <TableCell className="text-right">{tx.shares}</TableCell>
              <TableCell className="text-right">{tx.price.toLocaleString()}원</TableCell>
              <TableCell className="text-right">{tx.total_amount.toLocaleString()}원</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}