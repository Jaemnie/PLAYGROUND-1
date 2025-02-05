import { EditSectionForm } from './edit-section-form'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function EditSectionPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const supabase = await createClient()
  
  const { data: section, error } = await supabase
    .from('guide_sections')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !section) {
    notFound()
  }

  return <EditSectionForm section={section} />
} 