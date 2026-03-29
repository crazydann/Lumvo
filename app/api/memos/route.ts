import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'

const SYSTEM_PROMPT = `당신은 개인 비서입니다. 사용자의 메모를 분석하여 JSON 형식으로 정리해 주세요.

각 항목을 다음 기준으로 분류하세요:
- context: "work"(업무) 또는 "personal"(개인)
- type: "todo"(할 일), "idea"(아이디어), "schedule"(일정), "note"(메모)

할 일 예시: "김철수에게 메일 보내기" → type: "todo"
일정 예시: "다음주 월요일 팀 미팅" → type: "schedule"
아이디어 예시: "앱에 다크모드 추가하면 좋을 것 같다" → type: "idea"
메모 예시: 정보성 내용 → type: "note"

업무 관련 키워드: 회의, 보고서, 클라이언트, 팀, 프로젝트, 업무, 사무실, 동료
개인 관련 키워드: 가족, 친구, 개인 약속, 취미, 건강, 쇼핑

하나의 메모에서 여러 항목을 추출할 수 있습니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "items": [
    {
      "context": "work",
      "type": "todo",
      "content": "정리된 내용",
      "due_date": "YYYY-MM-DDTHH:mm:ss"
    }
  ]
}
due_date는 일정이 있을 경우만 포함하세요.`

export async function GET() {
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { raw_text } = await req.json()

  if (!raw_text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  // 1. AI 분석 + 임베딩 병렬 생성
  let items: { context: string; type: string; content: string; due_date?: string }[] = []
  let memoEmbedding: number[] | null = null

  const [analysisResult, embeddingResult] = await Promise.allSettled([
    // AI 분류
    openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: raw_text },
      ],
      response_format: { type: 'json_object' },
    }),
    // 임베딩 생성
    generateEmbedding(raw_text),
  ])

  if (analysisResult.status === 'fulfilled') {
    const content = analysisResult.value.choices[0].message.content
    if (content) {
      const parsed = JSON.parse(content)
      items = Array.isArray(parsed.items) ? parsed.items : []
    }
  } else {
    console.error('AI analysis error:', analysisResult.reason)
  }

  if (embeddingResult.status === 'fulfilled') {
    memoEmbedding = embeddingResult.value
  } else {
    console.error('Embedding error:', embeddingResult.reason)
  }

  // 2. 메모 저장
  const { data: memo, error: memoError } = await supabase
    .from('memos')
    .insert({ raw_text })
    .select()
    .single()

  if (memoError) {
    console.error('Memo insert error:', memoError)
    return NextResponse.json({ error: memoError.message }, { status: 500 })
  }

  // 3. 항목 저장 + 임베딩 저장
  if (items.length > 0) {
    const itemsToInsert = items.map((item) => ({
      memo_id: memo.id,
      context: item.context,
      type: item.type,
      content: item.content,
      due_date: item.due_date ?? null,
    }))

    const { data: savedItems, error: itemsError } = await supabase
      .from('items')
      .insert(itemsToInsert)
      .select()

    if (itemsError) {
      console.error('Items insert error:', itemsError)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // 각 항목에 임베딩 저장 (백그라운드)
    if (savedItems) {
      Promise.allSettled(
        savedItems.map(async (savedItem, idx) => {
          const itemText = items[idx].content
          const embedding = await generateEmbedding(itemText)
          await supabase
            .from('items')
            .update({ embedding })
            .eq('id', savedItem.id)
        })
      )
    }
  }

  return NextResponse.json({ memo, itemCount: items.length })
}
