'use client'

import { useState, useEffect } from 'react'

interface RelatedItem {
  id: string
  content: string
  type: string
  context: string
  is_done: boolean
  created_at: string
  similarity: number
}

interface Props {
  memoText: string
  newItemIds: string[]
  onDismiss: () => void
}

const TYPE_LABEL: Record<string, string> = {
  todo: '할 일',
  idea: '아이디어',
  schedule: '일정',
  note: '메모',
}

export default function RelatedMemos({ memoText, newItemIds, onDismiss }: Props) {
  const [items, setItems] = useState<RelatedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!memoText) return
    fetch('/api/related', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: memoText, excludeIds: newItemIds }),
    })
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [memoText, newItemIds])

  if (!loading && items.length === 0) return null

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
          🔗 관련된 과거 메모
        </p>
        <button
          onClick={onDismiss}
          className="text-xs text-blue-400 hover:text-blue-600"
        >
          닫기
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-blue-400 text-xs py-1">
          <span className="w-3 h-3 border-2 border-blue-300 border-t-blue-500 rounded-full animate-spin" />
          연관 메모 검색 중...
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl px-3 py-2.5 border border-blue-100">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs text-blue-400 font-medium">
                  {TYPE_LABEL[item.type] ?? item.type}
                </span>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs text-gray-400">
                  {item.context === 'work' ? '업무' : '개인'}
                </span>
              </div>
              <p className={`text-sm text-gray-700 leading-snug ${item.is_done ? 'line-through text-gray-400' : ''}`}>
                {item.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
