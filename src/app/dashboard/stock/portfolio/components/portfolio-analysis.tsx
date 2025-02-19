'use client'

import { CardHeader, CardContent } from '@/components/ui/card'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import { createClientBrowser } from '@/lib/supabase/client'

interface PortfolioAnalysisProps {
  portfolio: any[];
  points: number;
  user: { id: string };
}

interface PortfolioMetrics {
  unrealizedProfit: number;    // 미실현 손익
  realizedProfit: number;      // 실현 손익
  totalInvestedAmount: number; // 총 투자금액
  totalValue: number;          // 현재 포트폴리오 가치
  profitRate: number;          // 전체 수익률
}

interface Holding {
  shares: number;
  average_cost: number;
  company: {
    current_price: number;
  };
}

async function calculatePortfolioMetrics(userId: string): Promise<PortfolioMetrics> {
  const supabase = await createClientBrowser();
  
  // 1. 현재 보유 주식의 미실현 손익 계산
  const { data: holdings } = await supabase
    .from('holdings')
    .select<any, Holding>(`
      shares,
      average_cost,
      company:companies!inner(current_price)
    `)
    .eq('user_id', userId);

  // 2. 실현된 손익 조회
  const { data: realizedProfits } = await supabase
    .from('realized_profits')
    .select('realized_profit')
    .eq('user_id', userId);

  // 미실현 손익 계산
  const unrealizedProfit = (holdings || []).reduce((sum, holding) => 
    sum + (holding.shares * (holding.company.current_price - holding.average_cost)), 0);

  // 실현 손익 계산
  const realizedProfit = (realizedProfits || []).reduce((sum, record) =>  
    sum + record.realized_profit, 0);

  // 현재 투자금액
  const currentInvestment = (holdings || []).reduce((sum, holding) => 
    sum + (holding.shares * holding.average_cost), 0);

  // 현재 포트폴리오 가치
  const currentValue = (holdings || []).reduce((sum, holding) => 
    sum + (holding.shares * holding.company.current_price), 0);

  // 전체 수익률 계산 (실현 + 미실현)
  const totalProfit = realizedProfit + unrealizedProfit;
  const profitRate = (totalProfit / currentInvestment) * 100;

  return {
    unrealizedProfit,
    realizedProfit,
    totalInvestedAmount: currentInvestment,
    totalValue: currentValue,
    profitRate
  };
}

export default async function PortfolioAnalysis({ portfolio, points, user }: PortfolioAnalysisProps) {
  const metrics = await calculatePortfolioMetrics(user.id);
  
  // 보유 주식의 총 평가 금액 계산
  const stocksValue = portfolio.reduce((sum, holding) => {
    return sum + (holding.shares * holding.company.current_price)
  }, 0)
  
  // 투자 비용의 총합 계산
  const investedAmount = portfolio.reduce((sum, holding) => {
    return sum + (holding.shares * holding.average_cost)
  }, 0)
  
  const totalGain = stocksValue - investedAmount
  const gainPercentage = investedAmount > 0 ? (totalGain / investedAmount) * 100 : 0
  const isGainPositive = totalGain >= 0

  return (
    <>
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-100">포트폴리오 현황</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400">보유 포인트</p>
            <p className="text-2xl font-bold text-blue-400">{Math.floor(points).toLocaleString()} P</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">주식 자산</p>
            <p className="text-2xl font-bold text-gray-100">{Math.floor(stocksValue).toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">총 투자금액</p>
            <p className="text-2xl font-bold text-gray-100">{Math.floor(investedAmount).toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">실현 손익</p>
            <p className="text-2xl font-bold text-gray-100">{Math.floor(metrics.realizedProfit).toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">총 손익</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${isGainPositive ? 'text-green-500' : 'text-red-500'}`}>
                {Math.floor(totalGain).toLocaleString()}원
              </p>
              <span className={`flex items-center ${isGainPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isGainPositive ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                {Math.abs(gainPercentage).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  )
}