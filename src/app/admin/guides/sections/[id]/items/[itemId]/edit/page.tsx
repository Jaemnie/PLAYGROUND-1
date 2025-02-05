import { EditItemForm } from './edit-item-form'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function EditItemPage({ 
  params 
}: { 
  params: Promise<{ id: string; itemId: string }> 
}) {
  const { id, itemId } = await params;
  const supabase = await createClient()
  
  const { data: item, error } = await supabase
    .from('guide_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (error || !item) {
    notFound()
  }

  return <EditItemForm item={item} sectionId={id} />
} 