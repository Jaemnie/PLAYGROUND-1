'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { BackButton } from '@/components/back-button'
import { GuideContent } from './guide-content'

interface GuideItem {
  id: string
  title: string
  description: string
  content: string
}

interface GuidePageClientProps {
  item: GuideItem
}

export function GuidePageClient({ item }: GuidePageClientProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <BackButton />
      </div>
      
      <div className="container mx-auto py-20 px-4">
        <Suspense 
          fallback={
            <div className="flex min-h-[200px] w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <GuideContent item={item} />
        </Suspense>
      </div>
    </div>
  )
}