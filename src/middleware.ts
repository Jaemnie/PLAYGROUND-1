import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // cron API 경로에 대해서만 처리
  if (request.nextUrl.pathname.startsWith('/api/cron')) {
    // Authorization 헤더 확인
    const authHeader = request.headers.get('authorization')
    const expectedToken = `Bearer ${process.env.VERCEL_PROJECT_ID}`
    
    if (authHeader !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/cron/:path*'
}