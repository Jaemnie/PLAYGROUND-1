'use client'

import { CardHeader, CardContent } from '@/components/ui/card'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'

interface MarketOverviewProps {
  companies: any[]
}

export function MarketOverview({ companies }: MarketOverviewProps) {
  // 시가총액 상위 5개 기업 추출
  const topCompanies = companies.slice(0, 5)

  return (
    <>
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-100">시장 동향</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topCompanies.map((company) => (
            <div key={company.id} className="flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-100">{company.name}</p>
                <p className="text-sm text-gray-400">{company.ticker}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-100">
                  {company.current_price.toLocaleString()}원
                </p>
                <div className="flex items-center justify-end gap-1">
                  {/* 실제로는 전일 대비 등락률 계산 필요 */}
                  <ArrowUpIcon className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500">2.5%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </>
  )
}
