'use client'

import { useState, useEffect } from 'react'

interface Memo {
  id: string
  raw_text: string
  created_at: string
}

export default function MemoHistory() {
  const [memos, setMemos] = useState<Memo[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fetchMemos = async () => {
    setIsLoading(true)
    const res = await fetch('/api/memos')
    const data = await res.json()
    setMemos(data)
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen) fetchMemos()
  }, [isOpen])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return '방금'
    if (mins < 60) return `${mins}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (days < 7) return `${days}일 전`
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  // 날짜별 그룹핑
  const grouped = memos.reduce<Record<string, Memo[]>>((acc, memo) => {
    const date = new Date(memo.created_at).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    })
    acc[date] = acc[date] ? [...acc[date], memo] : [memo]
    return acc
  }, {})

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
      >
        <span>🕐</span> 메모 히스토리
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setIsOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 top-16 z-40 bg-white rounded-t-3xl overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">메모 히스토리</h2>
                <p className="text-xs text-gray-400 mt-0.5">원본 메모 전체 타임라인</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
              >
                ✕
              </button>
            </div>

            {/* 목록 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {isLoading ? (
                <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
              ) : memos.length === 0 ? (
                <div className="text-center py-12 text-gray-300 text-sm">메모가 없습니다</div>
              ) : (
                Object.entries(grouped).map(([date, dateMemos]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-gray-400 mb-3 sticky top-0 bg-white py-1">
                      {date}
                    </p>
                    <div className="space-y-3">
                      {dateMemos.map((memo) => (
                        <div key={memo.id} className="flex gap-3">
                          {/* 타임라인 선 */}
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                            <div className="w-px flex-1 bg-gray-100 mt-1" />
                          </div>
                          <div className="flex-1 pb-3">
                            <p className="text-xs text-gray-400 mb-1">{formatDate(memo.created_at)}</p>
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-sm text-gray-800 leading-relaxed">{memo.raw_text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
