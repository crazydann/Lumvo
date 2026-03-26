'use client'

import { Item } from '@/lib/types'

interface Props {
  item: Item
  onToggle: (id: string, isDone: boolean) => void
}

const typeLabel: Record<string, string> = {
  todo: '할 일',
  idea: '아이디어',
  schedule: '일정',
  note: '메모',
}

export default function ItemCard({ item, onToggle }: Props) {
  const isTodo = item.type === 'todo'

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
        item.is_done ? 'opacity-50' : 'hover:bg-gray-50'
      }`}
    >
      {isTodo ? (
        <button
          onClick={() => onToggle(item.id, !item.is_done)}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
            item.is_done
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-gray-500'
          }`}
        >
          {item.is_done && (
            <svg className="w-full h-full text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ) : (
        <span className="mt-1 w-5 h-5 flex-shrink-0 text-center text-xs">
          {item.type === 'idea' ? '💡' : item.type === 'schedule' ? '📅' : '📝'}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm text-gray-800 ${item.is_done ? 'line-through text-gray-400' : ''}`}>
          {item.content}
        </p>
        {item.due_date && (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(item.due_date).toLocaleString('ko-KR', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  )
}
