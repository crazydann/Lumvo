import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    console.log(`[transcribe] Received audio: ${audioFile.name}, size: ${audioFile.size} bytes`)

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ko',
    })

    console.log(`[transcribe] Result: "${transcription.text}"`)
    return NextResponse.json({ text: transcription.text })
  } catch (e) {
    console.error('[transcribe] Error:', e)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
