import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 경로 설정
  const protectedRoutes = ['/dashboard']
  const authRoutes = ['/login', '/signup', '/auth']

  // 경로 체크 함수
  const isProtectedRoute = (path: string) => 
    protectedRoutes.some(route => path.startsWith(route))
  const isAuthRoute = (path: string) =>
    authRoutes.some(route => path.startsWith(route))

  // 현재 경로
  const path = request.nextUrl.pathname

  // 로그인된 유저가 로그인/회원가입 페이지 접근시
  if (user && isAuthRoute(path)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 보호 경로 체크
  if (!user && isProtectedRoute(path)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
} 