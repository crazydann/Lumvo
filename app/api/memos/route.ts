import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AnalysisResult } from '@/lib/types'

export async function GET() {
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { raw_text, analysis }: { raw_text: string; analysis: AnalysisResult } = await req.json()

  // 1. 메모 저장
  const { data: memo, error: memoError } = await supabase
    .from('memos')
    .insert({ raw_text })
    .select()
    .single()

  if (memoError) return NextResponse.json({ error: memoError.message }, { status: 500 })

  // 2. 분석된 항목들 저장
  if (analysis.items.length > 0) {
    const itemsToInsert = analysis.items.map((item) => ({
      memo_id: memo.id,
      context: item.context,
      type: item.type,
      content: item.content,
      due_date: item.due_date ?? null,
    }))

    const { error: itemsError } = await supabase.from('items').insert(itemsToInsert)
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({ memo, itemCount: analysis.items.length })
}
