import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
      return NextResponse.json(
        { error: '필수 입력값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { error, data: authData } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !authData.user) {
      return NextResponse.redirect(new URL('/login?error=로그인에 실패했습니다', request.url))
    }

    return NextResponse.redirect(new URL('/main', request.url))
  } catch (err) {
    console.error('[API LOGIN ERROR]', err)
    return NextResponse.json(
      { error: '서버 오류 발생' },
      { status: 500 }
    )
  }
} 