import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

    // 회원가입 시도 (서버 액션과 동일한 방식으로 간소화)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      }
    })

    console.log('회원가입 응답:', { error })

    if (error) {
      console.error('Supabase 회원가입 에러:', error)
      return NextResponse.json({
        error: error.message || '회원가입에 실패했습니다',
        status: 400
      })
    }

    // 캐시 무효화 (서버 액션의 revalidatePath와 동일)
    revalidatePath('/', 'layout')

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