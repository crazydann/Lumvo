'use client'

import { useState } from 'react'
import VoiceRecorder from './VoiceRecorder'

interface Props {
  onSubmit: (text: string) => Promise<void>
}

export default function MemoInput({ onSubmit }: Props) {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit(text.trim())
      setText('')
    } catch (e) {
      setError((e as Error).message ?? '저장 실패')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTranscribed = (transcribedText: string) => {
    setText((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText))
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="메모를 입력하세요... (예: 김철수에게 제안서 메일 보내기)"
        className="w-full h-24 text-gray-800 placeholder-gray-400 resize-none outline-none text-sm leading-relaxed"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.metaKey) handleSubmit()
        }}
      />
      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <VoiceRecorder onTranscribed={handleTranscribed} />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting}
          className="px-5 py-2 bg-gray-900 text-white rounded-full text-sm font-medium disabled:opacity-40 hover:bg-gray-700 transition-colors"
        >
          {isSubmitting ? '분석 중...' : '저장 ⌘↵'}
        </button>
      </div>
    </div>
  )
}
