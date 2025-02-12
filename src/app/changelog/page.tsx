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
                <h2 className="text-2xl font-bold text-gray-100">2024년 3월</h2>
                <div className="mt-4 space-y-4">
                  <div className="border-l-2 border-blue-500 pl-4">
                    <h3 className="text-lg font-semibold text-gray-200">v1.2.0</h3>
                    <p className="text-sm text-gray-400">2024년 3월 15일</p>
                    <ul className="mt-2 space-y-2 text-gray-300">
                      <li>실시간 주식 정보 업데이트 기능 추가</li>
                      <li>포트폴리오 다각화 분석 기능 개선</li>
                      <li>UI/UX 개선 및 성능 최적화</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-100">2024년 2월</h2>
                <div className="mt-4 space-y-4">
                  <div className="border-l-2 border-blue-500 pl-4">
                    <h3 className="text-lg font-semibold text-gray-200">v1.1.0</h3>
                    <p className="text-sm text-gray-400">2024년 2월 28일</p>
                    <ul className="mt-2 space-y-2 text-gray-300">
                      <li>가이드 섹션 기능 추가</li>
                      <li>관리자 대시보드 개선</li>
                      <li>버그 수정 및 안정성 개선</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-100">2024년 1월</h2>
                <div className="mt-4 space-y-4">
                  <div className="border-l-2 border-blue-500 pl-4">
                    <h3 className="text-lg font-semibold text-gray-200">v1.0.0</h3>
                    <p className="text-sm text-gray-400">2024년 1월 15일</p>
                    <ul className="mt-2 space-y-2 text-gray-300">
                      <li>PLAYGROUND 서비스 정식 출시</li>
                      <li>기본 대시보드 기능 구현</li>
                      <li>사용자 인증 시스템 구축</li>
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