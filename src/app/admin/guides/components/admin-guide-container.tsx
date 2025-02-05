'use client'

import { useState } from 'react'
import { AdminGuideHeader } from './admin-guide-header'
import { AdminGuideList } from './admin-guide-list'
import { GuideSection } from '@/lib/types/guide'

interface AdminGuideContainerProps {
  initialSections: GuideSection[]
}

export function AdminGuideContainer({ initialSections }: AdminGuideContainerProps) {
  const [sections, setSections] = useState<GuideSection[]>(initialSections)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <section className="relative h-[40vh] overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative container mx-auto h-full flex flex-col items-center justify-center text-center space-y-8 px-4">
          <AdminGuideHeader />
        </div>
      </section>
      
      <section className="py-20 px-4 bg-black/40">
        <div className="container mx-auto">
          <AdminGuideList sections={sections} />
        </div>
      </section>
    </div>
  )
} 