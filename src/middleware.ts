import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // cron API 경로에 대해서는 기존 인증 로직 유지
  if (request.nextUrl.pathname.startsWith('/api/cron')) {
    const authHeader = request.headers.get('authorization')
    const upstashSignature = request.headers.get('upstash-signature')
    const expectedToken = `Bearer ${process.env.VERCEL_PROJECT_ID}`
    
    // upstash-signature 헤더가 없을 경우에만 authorization 헤더를 확인
    if (!upstashSignature && authHeader !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.next()
  }

  // 나머지 모든 경로에 대해 Supabase 세션 갱신
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}