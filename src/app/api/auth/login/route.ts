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
      let errorMsg = "로그인에 실패했습니다."
      if (error && error.message) {
        const msg = error.message.toLowerCase()
        // 이메일 인증 관련 에러 처리
        if (msg.includes("not confirmed") || msg.includes("confirm")) {
          errorMsg = "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요."
        }
        // 잘못된 아이디 혹은 비밀번호 입력 시
        else if (msg.includes("invalid login credentials")) {
          errorMsg = "아이디 또는 비밀번호가 일치하지 않습니다."
        }
      }
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    return NextResponse.json({ success: true, redirect: '/main' })
  } catch (err) {
    console.error('[API LOGIN ERROR]', err)
    return NextResponse.json(
      { error: '서버 오류 발생' },
      { status: 500 }
    )
  }
} 