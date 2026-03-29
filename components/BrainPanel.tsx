'use client'

import { useState } from 'react'

interface BrainResult {
  answer: string
  focus: string[]
  insights: string
  generated_at?: string
  related_count?: number
}

export default function BrainPanel() {
  const [result, setResult] = useState<BrainResult | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'briefing' | 'query'>('briefing')

  const getBriefing = async () => {
    setIsLoading(true)
    setMode('briefing')
    const res = await fetch('/api/brain')
    const data = await res.json()
    setResult(data)
    setIsLoading(false)
  }

  const askBrain = async () => {
    if (!query.trim()) return
    setIsLoading(true)
    setMode('query')
    const res = await fetch('/api/brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const data = await res.json()
    setResult(data)
    setIsLoading(false)
    setQuery('')
  }

  return (
    <div className="bg-gray-900 text-white rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <span className="font-semibold text-sm">AI 브레인</span>
        </div>
        <button
          onClick={getBriefing}
          disabled={isLoading}
          className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
        >
          {isLoading && mode === 'briefing' ? '분석 중...' : '오늘의 브리핑'}
        </button>
      </div>

      {/* 질문 입력 */}
      <div className="px-4 py-3 flex gap-2 border-b border-gray-800">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && askBrain()}
          placeholder="질문하기... (예: 이번 주 중요한 게 뭐야?)"
          className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-xl outline-none placeholder-gray-500"
        />
        <button
          onClick={askBrain}
          disabled={!query.trim() || isLoading}
          className="px-3 py-2 bg-white text-gray-900 text-sm font-medium rounded-xl disabled:opacity-40"
        >
          {isLoading && mode === 'query' ? '...' : '↑'}
        </button>
      </div>

      {/* 결과 */}
      <div className="p-4 space-y-4 min-h-[120px]">
        {!result && !isLoading && (
          <p className="text-gray-500 text-sm text-center pt-4">
            브리핑을 요청하거나 질문해 보세요
          </p>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm pt-4 justify-center">
            <span className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
            AI가 분석 중...
          </div>
        )}

        {result && !isLoading && (
          <>
            {/* 답변 */}
            <div>
              <p className="text-sm text-gray-100 leading-relaxed">{result.answer}</p>
            </div>

            {/* 집중 항목 */}
            {result.focus?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">지금 집중할 것</p>
                <div className="space-y-1.5">
                  {result.focus.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-blue-400 text-xs mt-0.5 font-bold">{i + 1}</span>
                      <span className="text-sm text-gray-200">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 인사이트 */}
            {result.insights && (
              <div className="border-t border-gray-800 pt-3">
                <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">인사이트</p>
                <p className="text-xs text-gray-400 leading-relaxed">{result.insights}</p>
              </div>
            )}

            {result.related_count !== undefined && (
              <p className="text-xs text-gray-600">관련 메모 {result.related_count}개 참조</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
