'use client'

import { useState, useRef } from 'react'

interface Props {
  onTranscribed: (text: string) => void
}

export default function VoiceRecorder({ onTranscribed }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder
    chunksRef.current = []

    mediaRecorder.ondataavailable = (e) => {
      chunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      setIsProcessing(true)
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('audio', blob, 'memo.webm')

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const { text } = await res.json()
      onTranscribed(text)
      setIsProcessing(false)
      stream.getTracks().forEach((t) => t.stop())
    }

    mediaRecorder.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`flex items-center gap-2 px-4 py-3 rounded-full font-medium transition-all ${
        isProcessing
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : isRecording
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      {isProcessing ? (
        <>
          <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          변환 중...
        </>
      ) : isRecording ? (
        <>
          <span className="w-3 h-3 bg-white rounded-full" />
          녹음 중지
        </>
      ) : (
        <>
          <span className="w-3 h-3 bg-white rounded-full" />
          음성 메모
        </>
      )}
    </button>
  )
}
