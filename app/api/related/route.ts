import { NextRequest, NextResponse } from 'next/server'
import { generateEmbedding, searchSimilarItems } from '@/lib/embeddings'
import { LIMITS } from '@/lib/api-security'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  try {
    const { text, excludeIds } = await req.json()
    if (!text?.trim()) {
      return NextResponse.json({ items: [] })
    }

    if (Buffer.byteLength(String(text), 'utf8') > LIMITS.MAX_TEXT_BYTES) {
      return NextResponse.json({ error: 'Text too large' }, { status: 413 })
    }

    // excludeIds는 UUID 형식만 허용
    const safeExcludeIds = Array.isArray(excludeIds)
      ? excludeIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))
      : []

    const embedding = await generateEmbedding(text)
    const results = await searchSimilarItems(embedding, 5, 0.45)

    const exclude = new Set<string>(safeExcludeIds)
    const filtered = results.filter((r) => !exclude.has(r.id)).slice(0, 3)

    return NextResponse.json({ items: filtered })
  } catch (e) {
    console.error('[related] Error:', e)
    return NextResponse.json({ items: [] })
  }
}
