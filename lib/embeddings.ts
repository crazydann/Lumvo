import { openai } from './openai'
import { supabase } from './supabase'

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

export async function searchSimilarItems(
  embedding: number[],
  limit = 8,
  threshold = 0.3
): Promise<{
  id: string
  content: string
  type: string
  context: string
  is_done: boolean
  created_at: string
  similarity: number
}[]> {
  const { data, error } = await supabase.rpc('match_items', {
    query_embedding: embedding,
    match_count: limit,
    match_threshold: threshold,
  })
  if (error) {
    console.error('Vector search error:', error)
    return []
  }
  return data ?? []
}
