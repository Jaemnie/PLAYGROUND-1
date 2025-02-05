'use client'

import dynamic from 'next/dynamic'

const MainPageClient = dynamic(
  () => import('../app/main/main-page-client').then(mod => mod.MainPageClient),
  { ssr: false }
)

export function MainPageWrapper(props: any) {
  return <MainPageClient {...props} />
} 