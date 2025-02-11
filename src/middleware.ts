import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // cron API 경로에 대해서만 처리
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
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/cron/:path*'
}