import { supabase } from './supabase'

export type MemoryType = 'summary' | 'people' | 'projects' | 'patterns'

export async function getMemory(type: MemoryType): Promise<string | null> {
  const { data } = await supabase
    .from('memory')
    .select('content')
    .eq('type', type)
    .single()
  return data?.content ?? null
}

export async function getAllMemory(): Promise<Record<string, string>> {
  const { data } = await supabase.from('memory').select('type, content')
  if (!data) return {}
  return Object.fromEntries(data.map((m) => [m.type, m.content]))
}

export async function upsertMemory(type: MemoryType, content: string): Promise<void> {
  await supabase
    .from('memory')
    .upsert({ type, content, updated_at: new Date().toISOString() }, { onConflict: 'type' })
}
