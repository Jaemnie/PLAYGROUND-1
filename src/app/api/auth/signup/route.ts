import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const nickname = formData.get('nickname') as string
    
    if (!email || !password || !nickname) {
      return NextResponse.json({ 
        error: '모든 필드를 입력해주세요',
        status: 400 
      })
    }
    
    console.log('회원가입 시도:', { email, nickname })
    
    const supabase = await createClient()

    // 1. 기본 회원가입 시도 (auth.users에는 email과 password만)
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      }
    })

    console.log('회원가입 응답:', { authData, signUpError })

    if (signUpError) {
      console.error('Supabase 회원가입 에러:', signUpError)
      return NextResponse.json({ 
        error: '회원가입에 실패했습니다. 다시 시도해주세요.',
        status: 400 
      })
    }

    if (!authData.user?.id) {
      return NextResponse.json({ 
        error: '사용자 생성에 실패했습니다',
        status: 400 
      })
    }

    // 2. profiles 테이블에 사용자 정보 저장
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        nickname,
        points: 0
      })

    if (profileError) {
      console.error('프로필 생성 에러:', profileError)
      // 프로필 생성 실패 시 사용자 삭제
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