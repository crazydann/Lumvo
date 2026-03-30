import { NextRequest, NextResponse } from 'next/server'
import { generateEmbedding, searchSimilarItems } from '@/lib/embeddings'

export async function POST(req: NextRequest) {
  try {
    const { text, excludeIds } = await req.json()
    if (!text?.trim()) {
      return NextResponse.json({ items: [] })
    }

    const embedding = await generateEmbedding(text)
    const results = await searchSimilarItems(embedding, 5, 0.45)

    const exclude = new Set<string>(excludeIds ?? [])
    const filtered = results.filter((r) => !exclude.has(r.id)).slice(0, 3)

    return NextResponse.json({ items: filtered })
  } catch (e) {
    console.error('[related] Error:', e)
    return NextResponse.json({ items: [] })
  }
}
