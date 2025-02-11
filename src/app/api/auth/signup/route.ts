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

    // 1. profiles 테이블에서 닉네임 중복 체크
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('nickname', nickname)
      .single()

    if (existingProfile) {
      return NextResponse.json({ 
        error: '이미 사용 중인 닉네임입니다',
        status: 400 
      })
    }

    // 2. 사용자 생성
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nickname: nickname // user_metadata에 닉네임 저장
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (signUpError || !authData.user) {
      console.error('Supabase 회원가입 에러:', signUpError)
      return NextResponse.json({ 
        error: signUpError?.message || '회원가입에 실패했습니다',
        status: 400 
      })
    }

    // 3. profiles 테이블에 사용자 정보 저장
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          nickname: nickname,
          points: 0,
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