'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface RankingTableProps {
  data: any[]
  title: string
}

export default function RankingTable({ data, title }: RankingTableProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-100 mb-4">{title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>순위</TableHead>
            <TableHead>사용자명</TableHead>
            <TableHead>수익률</TableHead>
            <TableHead>거래량</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((user, index) => (
            <TableRow key={user.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{user.user_name || '이름 없음'}</TableCell>
              <TableCell>{user.gain_percentage ? user.gain_percentage.toFixed(2) : '0.00'}%</TableCell>
              <TableCell>{user.trading_volume ? user.trading_volume.toLocaleString() : 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
} 