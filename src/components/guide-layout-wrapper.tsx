'use client'

import { DashboardBackButton } from '@/components/back-button'

export function GuideLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>
      {children}
    </div>
  )
} 