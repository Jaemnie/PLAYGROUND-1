'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error, data: authData } = await supabase.auth.signInWithPassword(data)

  if (error || !authData.user) {
    return redirect('/login?error=로그인에 실패했습니다')
  }

  revalidatePath('/', 'layout')
  return redirect('/main')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp({
    ...data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    return redirect('/signup?error=회원가입에 실패했습니다')
  }

  revalidatePath('/', 'layout')
  return redirect('/login?message=이메일을 확인해주세요')
}

export async function logout() {
  const supabase = await createClient()
  
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return redirect('/login')
} 

export async function adminguide() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return redirect('/login')
  }
  
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select()
    .eq('user_id', user.id)
    .single()
  
  if (adminError || !adminUser) {
    return redirect('/main')
  }

  revalidatePath('/', 'layout')
  return redirect('/admin/guides')
}