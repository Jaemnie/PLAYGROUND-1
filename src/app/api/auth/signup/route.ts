import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.json({ 
      error: '회원가입에 실패했습니다',
      status: 400 
    })
  }

  return NextResponse.json({ 
    message: '이메일을 확인해주세요',
    status: 200 
  })
} 