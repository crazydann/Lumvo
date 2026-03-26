'use client'

import { useState, useEffect, useCallback } from 'react'
import { Item, Context, ItemType } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import ItemCard from './ItemCard'
import MemoInput from './MemoInput'

const SECTIONS: { context: Context; label: string; icon: string }[] = [
  { context: 'work', label: '업무', icon: '💼' },
  { context: 'personal', label: '개인', icon: '🏠' },
]

const TYPE_TABS: { type: ItemType | 'all'; label: string }[] = [
  { type: 'all', label: '전체' },
  { type: 'todo', label: '할 일' },
  { type: 'idea', label: '아이디어' },
  { type: 'schedule', label: '일정' },
  { type: 'note', label: '메모' },
]

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([])
  const [activeTab, setActiveTab] = useState<ItemType | 'all'>('all')
  const [isLoading, setIsLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    const res = await fetch('/api/items')
    const data = await res.json()
    setItems(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()

    // 실시간 구독
    const channel = supabase
      .channel('items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        fetchItems()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchItems])

  const handleMemoSubmit = async (text: string) => {
    // 1. AI 분석
    const analysisRes = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const analysis = await analysisRes.json()

    // 2. 저장
    await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: text, analysis }),
    })

    fetchItems()
  }

  const handleToggle = async (id: string, isDone: boolean) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_done: isDone } : item)))
    await fetch('/api/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_done: isDone }),
    })
  }

  const filteredItems = items.filter((item) => activeTab === 'all' || item.type === activeTab)

  const getItemsByContext = (context: Context) =>
    filteredItems.filter((item) => item.context === context)

  const pendingTodos = items.filter((i) => i.type === 'todo' && !i.is_done).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Lumvo</h1>
            <p className="text-xs text-gray-400">개인 AI 비서</p>
          </div>
          {pendingTodos > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              할 일 {pendingTodos}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 메모 입력 */}
        <MemoInput onSubmit={handleMemoSubmit} />

        {/* 필터 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.type
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 대시보드 */}
        {isLoading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SECTIONS.map(({ context, label, icon }) => {
              const sectionItems = getItemsByContext(context)
              return (
                <div key={context} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                    <span>{icon}</span>
                    <h2 className="font-semibold text-gray-800">{label}</h2>
                    <span className="ml-auto text-xs text-gray-400">{sectionItems.length}개</span>
                  </div>
                  <div className="p-2">
                    {sectionItems.length === 0 ? (
                      <p className="text-center text-gray-300 text-sm py-8">항목 없음</p>
                    ) : (
                      sectionItems.map((item) => (
                        <ItemCard key={item.id} item={item} onToggle={handleToggle} />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
