import { createClient } from '@/lib/supabase/server'
import { SectionItems } from './section-items'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default async function SectionPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const supabase = await createClient()
  
  try {
    const [sectionResult, itemsResult] = await Promise.all([
      supabase
        .from('guide_sections')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('guide_items')
        .select('*')
        .eq('section_id', id)
        .order('created_at', { ascending: true })
    ])

    if (sectionResult.error || !sectionResult.data) {
      console.error('섹션을 찾을 수 없습니다:', sectionResult.error)
      notFound()
    }

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <SectionItems 
          section={sectionResult.data} 
          items={itemsResult.data || []} 
          sectionId={id}
        />
      </Suspense>
    )
  } catch (error) {
    console.error('Error:', error)
    notFound()
  }
}