import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

const MAX_TEXT_BYTES = 8_000     // 메모 텍스트 최대 8KB
const MAX_QUERY_BYTES = 2_000    // 브레인 쿼리 최대 2KB
const MAX_AUDIO_BYTES = 10 * 1024 * 1024 // 오디오 최대 10MB

export const LIMITS = { MAX_TEXT_BYTES, MAX_QUERY_BYTES, MAX_AUDIO_BYTES }

export function verifyToken(token: string | null): boolean {
  const expected = process.env.SHORTCUT_API_TOKEN
  if (!expected || !token) return false
  try {
    const a = Buffer.from(token)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function tooLarge(size: number, max: number) {
  return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
}

// AI가 반환한 context/type 값을 DB에 넣기 전에 허용값으로 sanitize
const ALLOWED_CONTEXT = new Set(['work', 'personal'])
const ALLOWED_TYPE = new Set(['todo', 'idea', 'schedule', 'note'])

export function sanitizeItem(item: {
  context: unknown
  type: unknown
  content: unknown
  due_date?: unknown
}) {
  const context = ALLOWED_CONTEXT.has(item.context as string) ? (item.context as string) : 'personal'
  const type = ALLOWED_TYPE.has(item.type as string) ? (item.type as string) : 'note'
  const content = typeof item.content === 'string' ? item.content.slice(0, 500) : ''
  const due_date =
    typeof item.due_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.due_date)
      ? item.due_date
      : null
  return { context, type, content, due_date }
}
