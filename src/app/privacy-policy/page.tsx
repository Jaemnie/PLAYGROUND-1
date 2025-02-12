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

      <section className="relative pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="prose prose-invert max-w-none"
          >
            <h1 className="text-4xl font-bold mb-8">개인정보 처리방침</h1>
            
            <h2>1. 개인정보의 수집 및 이용 목적</h2>
            <p>
              PLAYGROUND는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 
              다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 
              개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>

            <h2>2. 개인정보의 처리 및 보유기간</h2>
            <p>
              PLAYGROUND는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 
              수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>

            <h2>3. 개인정보의 제3자 제공</h2>
            <p>
              PLAYGROUND는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 
              내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조에 
              해당하는 경우에만 개인정보를 제3자에게 제공합니다.
            </p>

            <h2>4. 정보주체의 권리·의무 및 행사방법</h2>
            <p>
              정보주체는 PLAYGROUND에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 
              행사할 수 있습니다.
            </p>
            <ul>
              <li>개인정보 열람요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제요구</li>
              <li>처리정지 요구</li>
            </ul>
          </motion.div>
        </div>
      </section>
    </div>
  )
} 