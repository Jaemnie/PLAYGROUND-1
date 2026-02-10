'use client'

import { useState, useMemo } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { NewspaperIcon, ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
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
  sentiment: 'positive' | 'negative' | 'neutral';
  company_id?: string;
  companies?: {
    id: string;
    name: string;
    ticker: string;
  };
}

interface NewsGroup {
  timestamp: number;
  formattedTime: string;
  news: NewsItem[];
}

interface AllNewsClientProps {
  allNews: NewsItem[];
}

export function AllNewsClient({ allNews }: AllNewsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentTab, setCurrentTab] = useState('all')
  const [currentPage, setCurrentPage] = useState(0)
  const itemsPerPage = 1 // 페이지당 30분 그룹 1개씩 표시
  
  // 검색어로 필터링
  const filteredNews = allNews.filter(news => 
    news.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    news.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    news.companies?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  // 감정 분석으로 필터링
  const filteredBySentiment = currentTab === 'all' 
    ? filteredNews 
    : filteredNews.filter(news => news.sentiment === currentTab)

  // 30분 단위로 뉴스 그룹화
  const newsGroups = useMemo(() => {
    const groups: NewsGroup[] = []
    const sortedNews = [...filteredBySentiment].sort((a, b) => 
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    )
    
    sortedNews.forEach(news => {
      const date = new Date(news.published_at)
      // 30분 단위로 그룹화 (0분 또는 30분으로 내림)
      date.setMinutes(date.getMinutes() >= 30 ? 30 : 0)
      date.setSeconds(0)
      date.setMilliseconds(0)
      
      const timestamp = date.getTime()
      
      // 해당 타임스탬프 그룹이 있는지 확인
      let group = groups.find(g => g.timestamp === timestamp)
      
      if (!group) {
        const formattedTime = new Intl.DateTimeFormat('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(date)
        
        group = {
          timestamp,
          formattedTime,
          news: []
        }
        groups.push(group)
      }
      
      group.news.push(news)
    })
    
    // 타임스탬프 기준 내림차순 정렬 (최신순)
    return groups.sort((a, b) => b.timestamp - a.timestamp)
  }, [filteredBySentiment])
  
  // 페이지네이션 계산
  const totalPages = Math.ceil(newsGroups.length / itemsPerPage)
  const currentNewsGroups = newsGroups.slice(
    currentPage * itemsPerPage, 
    (currentPage + 1) * itemsPerPage
  )
  
  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1))
  }
  
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))
  }

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

  const getSentimentStyle = (sentiment: 'positive' | 'negative' | 'neutral') => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'negative':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    }
  }

  const getSentimentText = (sentiment: 'positive' | 'negative' | 'neutral') => {
    switch (sentiment) {
      case 'positive':
        return '긍정적'
      case 'negative':
        return '부정적'
      default:
        return '중립적'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <Link href="/dashboard/stock">
          <Button
            variant="ghost"
            className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70 flex items-center gap-2"
          >
            <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
            <span className="text-zinc-200">주식창</span>
          </Button>
        </Link>
      </div>

      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">
            STACKS
          </p>
          <h1 className="text-2xl font-bold text-gray-100">
            전체 뉴스 모음
          </h1>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">

        <Card className="mb-6 bg-black/40 backdrop-blur-sm border-gray-800">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
              <Input
                placeholder="뉴스 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md bg-gray-900/50 border-gray-800"
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

        {newsGroups.length === 0 ? (
          <Card className="bg-black/40 backdrop-blur-sm border-gray-800">
            <CardContent className="py-12">
              <p className="text-center text-gray-400">검색 결과가 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {currentNewsGroups.map((group) => (
              <div key={group.timestamp} className="mb-8">
                <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm p-3 rounded-lg mb-4 border border-blue-500/20">
                  <h2 className="text-lg font-medium text-blue-300">
                    {group.formattedTime} 뉴스 ({group.news.length}개)
                  </h2>
                </div>
                <div className="space-y-4">
                  {group.news.map((news) => (
                    <Card key={news.id} className="overflow-hidden bg-black/40 backdrop-blur-sm border-gray-800">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h2 className="text-xl font-bold text-gray-100">{news.title}</h2>
                              {news.companies && (
                                <Link 
                                  href={`/dashboard/stock/${news.companies.ticker}`}
                                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-1 inline-block"
                                >
                                  {news.companies.name}
                                </Link>
                              )}
                            </div>
                            <Badge className={`${getSentimentStyle(news.sentiment)}`}>
                              {getSentimentText(news.sentiment)}
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
              </div>
            ))}
            
            {/* 페이지네이션 컨트롤 */}
            <div className="flex justify-between items-center mt-8 mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrevPage} 
                disabled={currentPage === 0}
                className="border-gray-800 text-gray-300"
              >
                <ChevronLeftIcon className="w-5 h-5 mr-1" />
                이전
              </Button>
              
              <div className="text-gray-300">
                {currentPage + 1} / {totalPages} 페이지
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNextPage} 
                disabled={currentPage >= totalPages - 1}
                className="border-gray-800 text-gray-300"
              >
                다음
                <ChevronRightIcon className="w-5 h-5 ml-1" />
              </Button>
            </div>
          </>
        )}
        
        <div className="mt-6 text-center text-sm text-gray-500">
          총 {filteredBySentiment.length}개의 뉴스가 {newsGroups.length}개 시간대에 있습니다.
        </div>
        </div>
      </section>
    </div>
  )
} 