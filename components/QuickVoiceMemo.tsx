'use client'

import { useState, useRef } from 'react'

interface Props {
  onSaved: (itemCount: number) => void
  onError?: (msg: string) => void
}

type State = 'idle' | 'recording' | 'processing'

export default function QuickVoiceMemo({ onSaved, onError }: Props) {
  const [state, setState] = useState<State>('idle')
  const [seconds, setSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        clearInterval(timerRef.current!)
        // 스트림 즉시 해제
        stream.getTracks().forEach((t) => t.stop())
        setState('processing')

        try {
          // 1. 음성 → 텍스트
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          if (blob.size === 0) {
            setState('idle')
            setSeconds(0)
            return
          }

          const formData = new FormData()
          formData.append('audio', blob, 'memo.webm')

          const transcribeRes = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (!transcribeRes.ok) {
            const err = await transcribeRes.json().catch(() => ({}))
            throw new Error(err.error ?? `Transcription failed (${transcribeRes.status})`)
          }

          const { text } = await transcribeRes.json()
          if (!text?.trim()) {
            console.log('[QuickVoiceMemo] Empty transcription, skipping')
            setState('idle')
            setSeconds(0)
            return
          }

          console.log(`[QuickVoiceMemo] Transcribed: "${text}"`)

          // 2. 분석 + 저장
          const memoRes = await fetch('/api/memos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw_text: text }),
          })

          if (!memoRes.ok) {
            const err = await memoRes.json().catch(() => ({}))
            throw new Error(err.error ?? `Memo save failed (${memoRes.status})`)
          }

          const data = await memoRes.json()
          console.log(`[QuickVoiceMemo] Saved with ${data.itemCount} items`)
          onSaved(data.itemCount ?? 0)
        } catch (e) {
          console.error('[QuickVoiceMemo] Error:', e)
          onError?.((e as Error).message ?? '저장 실패')
        } finally {
          setState('idle')
          setSeconds(0)
        }
      }

      mediaRecorder.start(100) // 100ms마다 데이터 수집
      setState('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch (e) {
      console.error('[QuickVoiceMemo] Start error:', e)
      onError?.('마이크 권한이 필요합니다')
      setState('idle')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const handleTap = () => {
    if (state === 'idle') startRecording()
    else if (state === 'recording') stopRecording()
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

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
