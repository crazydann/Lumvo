import { NextRequest, NextResponse } from 'next/server'

// ⛔ 서비스 비활성화 상태 — 모든 API 요청 차단
// 재활성화: 이 파일을 삭제하거나 return NextResponse.next() 로 변경
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503 }
    )
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
