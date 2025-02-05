'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardHeader, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  MagnifyingGlassIcon 
} from '@heroicons/react/24/outline'

interface Company {
  id: string
  name: string
  ticker: string
  current_price: number
  market_cap: number
  industry: string
}

interface StockListProps {
  companies: Company[]
}

export function StockList({ companies }: StockListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({
    key: 'market_cap',
    direction: 'desc'
  })

  // 검색 필터링
  const filteredCompanies = companies.filter(company => 
    company.name.toLowerCase().includes(search.toLowerCase()) ||
    company.ticker.toLowerCase().includes(search.toLowerCase())
  )

  // 정렬 로직
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    const key = sortConfig.key as keyof Company;
    const aValue = a[key];
    const bValue = b[key];
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  })

  // 정렬 핸들러
  const requestSort = (key: keyof Company) => {
    setSortConfig(current => ({
      key,
      direction: 
        current.key === key && current.direction === 'asc' 
          ? 'desc' 
          : 'asc',
    }))
  }

  // 가격 변동 스타일 (실제로는 이전 가격과 비교하여 결정)
  const getPriceChangeStyle = (change: number) => {
    if (change > 0) return 'text-green-500'
    if (change < 0) return 'text-red-500'
    return 'text-gray-400'
  }

  return (
    <>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-100">주식 목록</h2>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="기업명 또는 종목 코드 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-black/30 border-gray-800 text-gray-100 placeholder:text-gray-500"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:text-gray-300"
                  onClick={() => requestSort('name')}
                >
                  기업명
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-gray-300"
                  onClick={() => requestSort('ticker')}
                >
                  종목 코드
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:text-gray-300"
                  onClick={() => requestSort('current_price')}
                >
                  현재가
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:text-gray-300"
                  onClick={() => requestSort('market_cap')}
                >
                  시가총액
                </TableHead>
                <TableHead className="text-right">거래</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCompanies.map((company) => (
                <TableRow 
                  key={company.id}
                  className="hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => router.push(`/dashboard/stock/${company.ticker}`)}
                >
                  <TableCell className="font-medium text-gray-100">
                    {company.name}
                  </TableCell>
                  <TableCell className="text-gray-400">
                    {company.ticker}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-medium text-gray-100">
                        {company.current_price.toLocaleString()}원
                      </span>
                      {/* 예시 변동률 (실제로는 DB에서 가져와야 함) */}
                      <span className={getPriceChangeStyle(1)}>
                        <ArrowUpIcon className="inline-block h-4 w-4" />
                        2.5%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-gray-400">
                    {(company.market_cap / 1_000_000).toFixed(0)}M
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/dashboard/stock/${company.ticker}/trade`)
                      }}
                    >
                      거래
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </>
  )
}
