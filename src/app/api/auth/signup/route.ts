import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    if (!email || !password) {
      return NextResponse.json({ 
        error: '이메일과 비밀번호를 입력해주세요',
        status: 400 
      })
    }
    
    console.log('회원가입 시도:', { email })
    
    const supabase = await createClient()

    // 순수 회원가입만 시도
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    })

    console.log('회원가입 응답:', { authData, signUpError })

    if (signUpError) {
      console.error('Supabase 회원가입 에러:', signUpError)
      return NextResponse.json({ 
        error: signUpError.message,
        status: 400 
      })
    }

    if (!authData.user?.id) {
      return NextResponse.json({ 
        error: '사용자 생성에 실패했습니다',
        status: 400 
      })
    }

    return NextResponse.json({ 
      message: '이메일을 확인해주세요',
      status: 200 
    })
  } catch (error) {
    console.error('회원가입 처리 중 에러:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      status: 500 
    })
  }
} 