'use client'

import { useState } from 'react'
import RankingTable from './components/ranking-table'
import PerformanceComparison from './components/performance-comparison'
import AchievementBadges from './components/achievement-badges'
import { Card } from '@/components/ui/card'
import { BackButton } from '@/components/back-button'

interface LeaderboardClientProps {
  allUsers: any[]
  performanceRanking: any[]
  volumeRanking: any[]
}

export function LeaderboardClient({ allUsers, performanceRanking, volumeRanking }: LeaderboardClientProps) {
  const [activeTab, setActiveTab] = useState('전체 사용자')

  const tabs = ['전체 사용자', '수익률 순위', '거래량 순위', '업적 시스템']

  const renderContent = () => {
    if (activeTab === '전체 사용자') {
      return <RankingTable data={allUsers} title="전체 사용자 랭킹" />
    } else if (activeTab === '수익률 순위') {
      return <RankingTable data={performanceRanking} title="수익률 순위" />
    } else if (activeTab === '거래량 순위') {
      return <RankingTable data={volumeRanking} title="거래량 순위" />
    } else if (activeTab === '업적 시스템') {
      return <AchievementBadges />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="fixed top-4 left-4 z-50">
        <BackButton />
      </div>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">랭킹 및 업적</h1>
        <div className="mb-6 flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded ${
                activeTab === tab
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <Card className="bg-black/40 backdrop-blur-sm border-gray-800 p-4 mb-6">
          {renderContent()}
        </Card>
        <PerformanceComparison performanceRanking={performanceRanking} />
      </div>
    </div>
  )
}

export default LeaderboardClient 