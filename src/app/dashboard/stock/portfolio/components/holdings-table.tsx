'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface HoldingsTableProps {
  portfolio: any[]
}

export default function HoldingsTable({ portfolio }: HoldingsTableProps) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">보유 주식 목록</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>종목명</TableHead>
            <TableHead>종목코드</TableHead>
            <TableHead className="text-right">보유 주식 수</TableHead>
            <TableHead className="text-right">평균 단가</TableHead>
            <TableHead className="text-right">현재가</TableHead>
            <TableHead className="text-right">평가 금액</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {portfolio.map((holding) => {
            const { company, shares, average_cost } = holding
            const currentPrice = company.current_price
            const totalValue = shares * currentPrice

            return (
              <TableRow key={holding.id}>
                <TableCell className="text-gray-100 font-medium">{company.name}</TableCell>
                <TableCell className="text-gray-400">{company.ticker}</TableCell>
                <TableCell className="text-right">{shares}</TableCell>
                <TableCell className="text-right">{Math.floor(average_cost).toLocaleString()}원</TableCell>
                <TableCell className="text-right">{Math.floor(currentPrice).toLocaleString()}원</TableCell>
                <TableCell className="text-right">{Math.floor(totalValue).toLocaleString()}원</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
