'use client'

import { useState } from 'react'
import { AdminGuideHeader } from './admin-guide-header'
import { AdminGuideList } from './admin-guide-list'
import { GuideSection } from '@/lib/types/guide'

interface AdminGuideContainerProps {
  initialSections: GuideSection[]
}

export function AdminGuideContainer({ initialSections }: AdminGuideContainerProps) {
  const [sections] = useState<GuideSection[]>(initialSections)

  return (
    <div className="flex flex-col w-full">
      <section className="relative overflow-hidden">
        <div className="container mx-auto flex flex-col items-center justify-center text-center space-y-8 px-4 py-16">
          <AdminGuideHeader />
        </div>
      </section>
      
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <AdminGuideList sections={sections} />
        </div>
      </section>
    </div>
  )
} 