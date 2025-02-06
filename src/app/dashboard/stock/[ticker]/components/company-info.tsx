'use client'

import { CardHeader, CardContent } from '@/components/ui/card'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'

interface CompanyInfoProps {
  company: any
  holding: any
}

export function CompanyInfo({ company, holding }: CompanyInfoProps) {
  // 가격 변동률 계산
  const priceChange = company.current_price && company.last_closing_price
    ? ((company.current_price - company.last_closing_price) / company.last_closing_price) * 100
    : 0
  const isPriceUp = priceChange > 0

  return (
    <>
      <CardHeader>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-100">{company.name}</h2>
            <span className="text-sm text-gray-400">{company.ticker}</span>
          </div>
          <p className="text-gray-400">{company.industry}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-400">현재가</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-gray-100">
                  {Math.floor(company.current_price).toLocaleString()}원
                </p>
                <span className={`flex items-center ${isPriceUp ? 'text-green-500' : 'text-red-500'}`}>
                  {isPriceUp ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                  {Math.abs(priceChange).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">전일대비</span>
                <span className={`text-sm ${isPriceUp ? 'text-green-500' : 'text-red-500'}`}>
                  {isPriceUp ? '+' : '-'}
                  {Math.floor(Math.abs(company.current_price - company.last_closing_price)).toLocaleString()}원
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-gray-400">보유 현황</p>
            {holding ? (
              <div className="space-y-1">
                <p className="text-xl font-bold text-gray-100">
                  {holding.shares.toLocaleString()}주
                </p>
                <p className="text-sm text-gray-400">
                  평균단가: {Math.floor(holding.average_cost).toLocaleString()}원
                </p>
              </div>
            ) : (
              <p className="text-gray-400">미보유</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm text-gray-400 mb-2">기업 설명</p>
          <p className="text-gray-300">{company.description}</p>
        </div>
      </CardContent>
    </>
  )
} 