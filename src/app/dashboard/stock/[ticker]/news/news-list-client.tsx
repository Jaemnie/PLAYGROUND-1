'use client'

import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { NewspaperIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface NewsItem {
  id: string;
  title: string;
  content: string;
  published_at: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface Company {
  id: string;
  name: string;
  ticker: string;
  logo_url?: string;
}

interface NewsListClientProps {
  company: Company;
  companyNews: NewsItem[];
}

export function NewsListClient({ company, companyNews }: NewsListClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentTab, setCurrentTab] = useState('all')
  
  // 검색어로 필터링
  const filteredNews = companyNews.filter(news => 
    news.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    news.content.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  // 영향도로 필터링
  const filteredByImpact = currentTab === 'all' 
    ? filteredNews 
    : filteredNews.filter(news => news.impact === currentTab)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getImpactStyle = (impact: 'positive' | 'negative' | 'neutral') => {
    switch (impact) {
      case 'positive':
        return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'negative':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    }
  }

  const getImpactText = (impact: 'positive' | 'negative' | 'neutral') => {
    switch (impact) {
      case 'positive':
        return '긍정적'
      case 'negative':
        return '부정적'
      default:
        return '중립적'
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <NewspaperIcon className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            {company.name} 뉴스 모음
          </h1>
        </div>
        <Link href={`/dashboard/stock/${company.ticker}`} passHref>
          <Button
            variant="outline"
            size="sm"
            className="text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            <span>돌아가기</span>
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
            <Input
              placeholder="뉴스 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="all">전체</TabsTrigger>
                <TabsTrigger value="positive">긍정적</TabsTrigger>
                <TabsTrigger value="neutral">중립적</TabsTrigger>
                <TabsTrigger value="negative">부정적</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {filteredByImpact.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-gray-400">검색 결과가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredByImpact.map((news) => (
            <Card key={news.id} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold text-gray-100">{news.title}</h2>
                    <Badge className={`${getImpactStyle(news.impact)}`}>
                      {getImpactText(news.impact)}
                    </Badge>
                  </div>
                  <p className="text-gray-300/90 leading-relaxed">{news.content}</p>
                  <p className="text-sm text-gray-400/80">
                    {formatDate(news.published_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <div className="mt-6 text-center text-sm text-gray-500">
        총 {filteredByImpact.length}개의 뉴스가 있습니다.
      </div>
    </div>
  )
} 