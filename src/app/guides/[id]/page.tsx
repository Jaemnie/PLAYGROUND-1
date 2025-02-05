import { createClient } from '@/lib/supabase/server'
import { GuidePageClient } from './guide-page-client'
import { notFound } from 'next/navigation'

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  if (typeof id !== 'string' || !id) {
    notFound();
  }

  const supabase = await createClient()
  
  try {
    const { data: item, error } = await supabase
      .from('guide_items')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !item) {
      console.error('데이터를 찾을 수 없습니다:', error)
      notFound()
    }

    return <GuidePageClient item={item} />
    
  } catch (error) {
    console.error('서버 오류:', error)
    notFound()
  }
} 