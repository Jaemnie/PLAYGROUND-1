import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { NewSectionForm } from './new-section-form'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { redirect } from 'next/navigation'

export default async function NewSectionPage() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <NewSectionForm user={user} />
    </Suspense>
  )
}