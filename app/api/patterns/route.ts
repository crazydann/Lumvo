import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export interface PatternAlert {
  content: string
  count: number
  context: string
  lastCreated: string
}

// 미완료 할일 중 내용이 유사한 것들을 그룹핑해서 반복 패턴 감지
export async function GET() {
  const { data: todos } = await supabase
    .from('items')
    .select('id, content, context, is_done, created_at')
    .eq('type', 'todo')
    .order('created_at', { ascending: false })

  if (!todos || todos.length === 0) {
    return NextResponse.json([])
  }

  // 텍스트 정규화 (공백, 조사 등 제거)
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[을를이가은는의도에서로]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  // 유사도 체크 (핵심 단어 2개 이상 겹치면 같은 패턴으로 간주)
  const getKeywords = (s: string) =>
    normalize(s).split(' ').filter((w) => w.length > 1)

  const isSimilar = (a: string, b: string) => {
    const kA = new Set(getKeywords(a))
    const kB = new Set(getKeywords(b))
    const intersection = [...kA].filter((k) => kB.has(k))
    return intersection.length >= 2
  }

  // 그룹핑
  const groups: { representative: string; items: typeof todos; context: string }[] = []

  for (const todo of todos) {
    const existing = groups.find((g) => isSimilar(g.representative, todo.content))
    if (existing) {
      existing.items.push(todo)
    } else {
      groups.push({ representative: todo.content, items: [todo], context: todo.context })
    }
  }

  // 2회 이상 반복된 그룹 + 아직 미완료 있는 것만
  const alerts: PatternAlert[] = groups
    .filter((g) => g.items.length >= 2 && g.items.some((i) => !i.is_done))
    .map((g) => ({
      content: g.representative,
      count: g.items.length,
      context: g.context,
      lastCreated: g.items[0].created_at,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return NextResponse.json(alerts)
}
