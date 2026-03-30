'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Item, Context, ItemType } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import ItemCard from './ItemCard'
import MemoInput from './MemoInput'
import BrainPanel from './BrainPanel'
import MemoHistory from './MemoHistory'
import PatternAlerts from './PatternAlerts'
import QuickVoiceMemo from './QuickVoiceMemo'
import RelatedMemos from './RelatedMemos'

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
  const [showInput, setShowInput] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [memoSaveCount, setMemoSaveCount] = useState(0)
  const [lastMemoText, setLastMemoText] = useState<string | null>(null)
  const [lastMemoItemIds, setLastMemoItemIds] = useState<string[]>([])
  const [showRelated, setShowRelated] = useState(false)
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const PULL_THRESHOLD = 70

  const fetchItems = useCallback(async () => {
    const res = await fetch('/api/items')
    const data = await res.json()
    setItems(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()
    const channel = supabase
      .channel('items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        fetchItems()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchItems])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === 0) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) setPullY(Math.min(delta * 0.5, PULL_THRESHOLD))
  }

  const handleTouchEnd = async () => {
    if (pullY >= PULL_THRESHOLD) {
      setIsRefreshing(true)
      await fetchItems()
      setIsRefreshing(false)
    }
    setPullY(0)
    touchStartY.current = 0
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleMemoSubmit = async (text: string) => {
    const res = await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: text }),
    })
    const data = await res.json()
    fetchItems()
    setShowInput(false)
    setMemoSaveCount((c) => c + 1)
    setLastMemoText(text)
    setLastMemoItemIds(data.itemIds ?? [])
    setShowRelated(true)
    showToast(`✅ ${data.itemCount ?? 0}개 항목으로 정리됐습니다`)
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
  const getItemsByContext = (context: Context) => filteredItems.filter((item) => item.context === context)
  const pendingTodos = items.filter((i) => i.type === 'todo' && !i.is_done).length

  return (
    <div
      className="min-h-screen bg-gray-50 pb-24"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh 인디케이터 */}
      <div
        className="flex justify-center items-center overflow-hidden transition-all duration-200"
        style={{ height: pullY > 0 ? pullY : 0 }}
      >
        <div className={`w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full ${isRefreshing || pullY >= PULL_THRESHOLD ? 'animate-spin border-gray-700' : ''}`} />
      </div>
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">Lumvo</h1>
            <p className="text-xs text-gray-400 mt-0.5">개인 AI 비서</p>
          </div>
          <div className="flex items-center gap-3">
            <MemoHistory />
            {pendingTodos > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                할 일 {pendingTodos}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* AI 브레인 */}
        <BrainPanel refreshTrigger={memoSaveCount} />

        {/* 반복 패턴 알림 */}
        <PatternAlerts />

        {/* 관련 과거 메모 */}
        {showRelated && lastMemoText && (
          <RelatedMemos
            memoText={lastMemoText}
            newItemIds={lastMemoItemIds}
            onDismiss={() => setShowRelated(false)}
          />
        )}

        {/* 필터 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeTab === tab.type
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 대시보드 */}
        {isLoading ? (
          <div className="text-center py-20 text-gray-400 text-sm">불러오는 중...</div>
        ) : (
          <div className="space-y-4">
            {SECTIONS.map(({ context, label, icon }) => {
              const sectionItems = getItemsByContext(context)
              return (
                <div key={context} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <h2 className="font-semibold text-gray-800 text-sm">{label}</h2>
                    <span className="ml-auto text-xs text-gray-400">{sectionItems.length}개</span>
                  </div>
                  <div className="p-2">
                    {sectionItems.length === 0 ? (
                      <p className="text-center text-gray-300 text-sm py-6">항목 없음</p>
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

      {/* 하단 플로팅 메모 입력 시트 */}
      {showInput && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-30"
            onClick={() => setShowInput(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl p-4 pb-8">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <MemoInput onSubmit={handleMemoSubmit} />
          </div>
        </>
      )}

      {/* 하단 FAB - 텍스트(+) + 음성(🎤) */}
      {!showInput && (
        <div className="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-3">
          <QuickVoiceMemo
            onSaved={(count, text, itemIds) => {
              fetchItems()
              setMemoSaveCount((c) => c + 1)
              setLastMemoText(text)
              setLastMemoItemIds(itemIds)
              setShowRelated(true)
              showToast(`✅ ${count}개 항목으로 정리됐습니다`)
            }}
            onError={(msg) => showToast(`❌ ${msg}`)}
          />
          <button
            onClick={() => setShowInput(true)}
            className="w-14 h-14 bg-gray-900 text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-95 transition-transform"
            aria-label="텍스트 메모"
          >
            +
          </button>
        </div>
      )}

      {/* 토스트 알림 */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
