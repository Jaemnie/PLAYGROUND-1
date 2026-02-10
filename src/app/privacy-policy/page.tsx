'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PrivacyPolicyPage() {
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

      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">
              STACKS
            </p>
            <h1 className="text-2xl font-bold text-gray-100">
              개인정보 처리방침
            </h1>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
          <div className="prose prose-invert max-w-none">
            
            <h2>1. 개인정보의 수집 및 이용 목적</h2>
            <p>
              STACKS는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 
              다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 
              개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>

            <h2>2. 개인정보의 처리 및 보유기간</h2>
            <p>
              STACKS는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 
              수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>

            <h2>3. 개인정보의 제3자 제공</h2>
            <p>
              STACKS는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 
              내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조에 
              해당하는 경우에만 개인정보를 제3자에게 제공합니다.
            </p>

            <h2>4. 정보주체의 권리·의무 및 행사방법</h2>
            <p>
              정보주체는 STACKS에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 
              행사할 수 있습니다.
            </p>
            <ul>
              <li>개인정보 열람요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제요구</li>
              <li>처리정지 요구</li>
            </ul>

            <h2>5. 개인정보의 안전성 확보조치</h2>
            <p>
              STACKS는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:
            </p>
            <ul>
              <li>관리적 조치: 내부관리계획 수립 및 시행, 정기적 직원 교육</li>
              <li>기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치</li>
              <li>물리적 조치: 전산실, 자료보관실 등의 접근통제</li>
            </ul>

            <h2>6. 개인정보 보호책임자</h2>
            <p>
              STACKS는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 
              정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <ul>
              <li>개인정보 보호책임자</li>
              <li>직책: 대표</li>
              <li>연락처: contact@stacks.com</li>
            </ul>

            <h2>7. 개인정보처리방침의 변경</h2>
            <p>
              이 개인정보처리방침은 2024년 3월 1일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 
              삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
} 