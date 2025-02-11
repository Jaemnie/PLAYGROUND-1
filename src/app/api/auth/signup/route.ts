import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const nickname = formData.get('nickname') as string
    
    console.log('회원가입 시도:', { email, nickname })
    
    const supabase = await createClient()

    // 1. 사용자 생성
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (signUpError) {
      console.error('Supabase 회원가입 에러:', signUpError)
      return NextResponse.json({ 
        error: signUpError.message,
        status: 400 
      })
    }

    // 2. profiles 테이블에 사용자 정보 저장
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,  // uuid 타입의 id 컬럼
          nickname: nickname,     // text 타입의 nickname 컬럼
          points: 0,             // numeric 타입의 points 컬럼 (기본값 0)
        }
      ])

    if (profileError) {
      // profiles 테이블 저장 실패 시 생성된 사용자도 삭제
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ 
        error: '프로필 생성에 실패했습니다',
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