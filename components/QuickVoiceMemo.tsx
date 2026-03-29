'use client'

import { useState, useRef } from 'react'

interface Props {
  onSaved: (itemCount: number) => void
}

type State = 'idle' | 'recording' | 'processing'

export default function QuickVoiceMemo({ onSaved }: Props) {
  const [state, setState] = useState<State>('idle')
  const [seconds, setSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder
    chunksRef.current = []

    mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data)
    mediaRecorder.onstop = async () => {
      clearInterval(timerRef.current!)
      setState('processing')
      stream.getTracks().forEach((t) => t.stop())

      try {
        // 1. 음성 → 텍스트
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob, 'memo.webm')
        const transcribeRes = await fetch('/api/transcribe', { method: 'POST', body: formData })
        const { text } = await transcribeRes.json()

        if (!text?.trim()) {
          setState('idle')
          setSeconds(0)
          return
        }

        // 2. 분석 + 저장 (자동)
        const memoRes = await fetch('/api/memos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: text }),
        })
        const data = await memoRes.json()
        onSaved(data.itemCount ?? 0)
      } catch (e) {
        console.error(e)
      } finally {
        setState('idle')
        setSeconds(0)
      }
    }

    mediaRecorder.start()
    setState('recording')
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
  }

  const handleTap = () => {
    if (state === 'idle') startRecording()
    else if (state === 'recording') stopRecording()
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <button
      onClick={handleTap}
      disabled={state === 'processing'}
      className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
        state === 'recording'
          ? 'bg-red-500 shadow-red-200'
          : state === 'processing'
          ? 'bg-gray-400'
          : 'bg-blue-600 shadow-blue-200'
      }`}
      aria-label="음성 메모"
    >
      {/* 녹음 중 파동 애니메이션 */}
      {state === 'recording' && (
        <>
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
            {formatTime(seconds)}
          </span>
        </>
      )}

      {state === 'processing' ? (
        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : state === 'recording' ? (
        <span className="w-4 h-4 bg-white rounded-sm" />
      ) : (
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 17.93V21h2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
        </svg>
      )}
    </button>
  )
}
