'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ChangelogPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            type="button"
            onClick={() => router.back()}
            variant="ghost"
            className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70 flex items-center gap-2"
          >
            <ArrowLeft className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
            <span className="text-zinc-200">뒤로가기</span>
          </Button>
        </motion.div>
      </div>

      <section className="relative pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="prose prose-invert max-w-none"
          >
            <h1 className="text-4xl font-bold mb-8">변경사항</h1>

            <div className="space-y-12">
              <div>
                <h2 className="text-2xl font-bold text-gray-100">2024년 2월</h2>
                <div className="mt-4 space-y-4">
                  <div className="border-l-2 border-blue-500 pl-4">
                    <h3 className="text-lg font-semibold text-gray-200">v1.4.0</h3>
                    <p className="text-sm text-gray-400">2024년 2월 13일</p>
                    <ul className="mt-2 space-y-2 text-gray-300">
                      <li>실시간 주식 차트 시스템 개선</li>
                      <li>한국식 캔들스틱 차트 구현</li>
                      <li>기업 상세 정보에 뉴스 섹션 추가</li>
                      <li>거래 알고리즘 및 밸런스 조정</li>
                      <li>장 운영 시간에 따른 거래 제한 기능 구현</li>
                      <li>회원가입 프로세스 개선</li>
                    </ul>
                  </div>

                  <div className="border-l-2 border-blue-500 pl-4">
                    <h3 className="text-lg font-semibold text-gray-200">v1.3.5</h3>
                    <p className="text-sm text-gray-400">2024년 2월 12일</p>
                    <ul className="mt-2 space-y-2 text-gray-300">
                      <li>실시간 프로필 상태 업데이트 기능 추가</li>
                      <li>손익 계산 알고리즘 개선</li>
                      <li>마켓 스케줄러 시스템 통합 및 최적화</li>
                      <li>전반적인 UI/UX 개선</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-100">2025년 2월</h2>
                <div className="mt-4 space-y-4">
                  <div className="border-l-2 border-blue-500 pl-4">
                    <h3 className="text-lg font-semibold text-gray-200">v1.3.0</h3>
                    <p className="text-sm text-gray-400">2025년 2월 11일</p>
                    <ul className="mt-2 space-y-2 text-gray-300">
                      <li>실시간 주식 시장 타이머 및 스케줄러 구현</li>
                      <li>Redis를 활용한 실시간 데이터 처리 최적화</li>
                      <li>장 운영 시간에 따른 매수/매도 제한 기능 추가</li>
                      <li>로그인/회원가입 시스템 개선</li>
                      <li>알림 시스템 구현</li>
                      <li>전반적인 UI/UX 개선</li>
                    </ul>
                  </div>

                  <div className="border-l-2 border-blue-500 pl-4">
                    <h3 className="text-lg font-semibold text-gray-200">v1.2.0</h3>
                    <p className="text-sm text-gray-400">2025년 2월 5일</p>
                    <ul className="mt-2 space-y-2 text-gray-300">
                      <li>실시간 주식 차트 데이터 구현</li>
                      <li>대시보드 UI 개선</li>
                      <li>스케줄러 시스템 도입</li>
                      <li>알림 시스템 기초 구현</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-100">2025년 1월</h2>
                <div className="mt-4 space-y-4">
                  <div className="border-l-2 border-blue-500 pl-4">
                    <h3 className="text-lg font-semibold text-gray-200">v1.0.0</h3>
                    <p className="text-sm text-gray-400">2025년 1월 23일</p>
                    <ul className="mt-2 space-y-2 text-gray-300">
                      <li>PLAYGROUND 서비스 초기 버전 출시</li>
                      <li>Next.js 프로젝트 기반 구축</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
} 