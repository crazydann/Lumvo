'use client'

import { useState, useEffect, useRef } from 'react'

interface Structured {
  focus: string[]
  insights: string
}

interface BriefingCache {
  text: string
  structured: Structured | null
  timestamp: number
  date: string
}

const CACHE_KEY = 'lumvo_briefing_cache'
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4시간

function loadCache(): BriefingCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as BriefingCache
    const today = new Date().toDateString()
    if (cache.date !== today) return null
    if (Date.now() - cache.timestamp > CACHE_TTL) return null
    return cache
  } catch {
    return null
  }
}

function saveCache(text: string, structured: Structured | null) {
  try {
    const cache: BriefingCache = {
      text,
      structured,
      timestamp: Date.now(),
      date: new Date().toDateString(),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore */ }
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}

export default function BrainPanel({ refreshTrigger }: { refreshTrigger?: number }) {
  const [streamText, setStreamText] = useState('')
  const [structured, setStructured] = useState<Structured | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAutoLoad, setIsAutoLoad] = useState(false)
  const hasAutoLoaded = useRef(false)

  // 앱 진입 시 자동 브리핑
  useEffect(() => {
    if (hasAutoLoaded.current) return
    hasAutoLoaded.current = true

    const cache = loadCache()
    if (cache) {
      setStreamText(cache.text)
      setStructured(cache.structured)
      return
    }

    setIsAutoLoad(true)
    runStream('/api/brain/stream', undefined, true)
  }, [])

  // 새 메모 저장 후 캐시 무효화 → 다음 접속 때 새 브리핑
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      clearCache()
    }
  }, [refreshTrigger])

  const runStream = async (url: string, options?: RequestInit, isAuto = false) => {
    setIsLoading(true)
    setStreamText('')
    setStructured(null)

    let fullText = ''
    let finalStructured: Structured | null = null

    try {
      const res = await fetch(url, options)
      if (!res.body) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)

          if (payload === '[DONE]') break
          if (payload === '[ERROR]') break
          if (payload.startsWith('[STRUCTURED]')) {
            try {
              finalStructured = JSON.parse(payload.slice(12)) as Structured
              setStructured(finalStructured)
            } catch { /* ignore */ }
          } else {
            fullText += payload
            setStreamText((prev) => prev + payload)
          }
        }
      }

      // 캐시 저장
      if (fullText) saveCache(fullText, finalStructured)
    } finally {
      setIsLoading(false)
      setIsAutoLoad(false)
    }
  }

  const getBriefing = () => {
    clearCache()
    runStream('/api/brain/stream')
  }

  const askBrain = () => {
    if (!query.trim()) return
    const q = query
    setQuery('')
    runStream('/api/brain/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })
  }

  return (
    <div className="bg-gray-900 text-white rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span>🧠</span>
          <span className="font-semibold text-sm">AI 브레인</span>
          {isLoading && (
            <span className="w-3 h-3 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
          )}
          {!isLoading && streamText && (
            <span className="text-xs text-gray-600">
              {isAutoLoad ? '' : '· 캐시됨'}
            </span>
          )}
        </div>
        <button
          onClick={getBriefing}
          disabled={isLoading}
          className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
        >
          🔄 새로고침
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
          className="px-3 py-2 bg-white text-gray-900 text-sm font-bold rounded-xl disabled:opacity-40"
        >
          ↑
        </button>
      </div>

      {/* 결과 */}
      <div className="p-4 space-y-4 min-h-[100px]">
        {!streamText && isLoading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm pt-2 justify-center">
            <span className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
            브레인 분석 중...
          </div>
        )}

        {!streamText && !isLoading && (
          <p className="text-gray-500 text-sm text-center pt-2">
            브리핑을 요청하거나 질문해 보세요
          </p>
        )}

        {streamText && (
          <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">
            {streamText}
            {isLoading && <span className="animate-pulse">▌</span>}
          </p>
        )}

        {structured?.focus && structured.focus.length > 0 && (
          <div className="border-t border-gray-800 pt-3">
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">지금 집중할 것</p>
            <div className="space-y-1.5">
              {structured.focus.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-blue-400 text-xs mt-0.5 font-bold">{i + 1}</span>
                  <span className="text-sm text-gray-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {structured?.insights && (
          <div className="border-t border-gray-800 pt-3">
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">인사이트</p>
            <p className="text-xs text-gray-400 leading-relaxed">{structured.insights}</p>
          </div>
        )}
      </div>
    </div>
  )
}
