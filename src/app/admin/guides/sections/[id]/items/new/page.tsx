import { NewItemForm } from './new-item-form'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'

export default async function NewItemPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const supabase = await createClient()
  
  // 섹션이 존재하는지 확인
  const { data: section, error } = await supabase
    .from('guide_sections')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !section) {
    notFound()
  }

  // 사용자 인증 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/auth/login')
  }

  return <NewItemForm user={user} sectionId={id} />
} 