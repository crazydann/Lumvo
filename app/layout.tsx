import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lumvo - AI 개인 비서',
  description: '음성과 텍스트 메모를 AI가 자동으로 분류하고 정리합니다',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  )
}
