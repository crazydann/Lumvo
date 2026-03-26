import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { supabase } from '@/lib/supabase'
import { AnalysisResult } from '@/lib/types'

// Siri Shortcut / Apple Watch 에서 메모를 전송하는 전용 엔드포인트
// 간단한 토큰 인증으로 보호됨

const SYSTEM_PROMPT = `당신은 개인 비서입니다. 사용자의 메모를 분석하여 JSON 형식으로 정리해 주세요.

각 항목을 다음 기준으로 분류하세요:
- context: "work"(업무) 또는 "personal"(개인)
- type: "todo"(할 일), "idea"(아이디어), "schedule"(일정), "note"(메모)

하나의 메모에서 여러 항목을 추출할 수 있습니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "items": [
    {
      "context": "work" | "personal",
      "type": "todo" | "idea" | "schedule" | "note",
      "content": "정리된 내용",
      "due_date": "YYYY-MM-DDTHH:mm:ss"
    }
  ]
}`

export async function POST(req: NextRequest) {
  // 토큰 인증
  const token = req.headers.get('x-api-token') ?? req.nextUrl.searchParams.get('token')
  if (token !== process.env.SHORTCUT_API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  let text = ''

  if (contentType.includes('application/json')) {
    const body = await req.json()
    text = body.text ?? ''
  } else {
    // Shortcuts에서 plain text로 보내는 경우
    text = await req.text()
  }

  if (!text.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  // AI 분석
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    response_format: { type: 'json_object' },
  })

  const analysis = JSON.parse(completion.choices[0].message.content!) as AnalysisResult

  // 메모 저장
  const { data: memo } = await supabase
    .from('memos')
    .insert({ raw_text: text })
    .select()
    .single()

  // 항목 저장
  if (memo && analysis.items.length > 0) {
    await supabase.from('items').insert(
      analysis.items.map((item) => ({
        memo_id: memo.id,
        context: item.context,
        type: item.type,
        content: item.content,
        due_date: item.due_date ?? null,
      }))
    )
  }

  // Siri/Shortcuts 에서 읽기 좋은 응답
  const summary = analysis.items.map((i) => `• ${i.content}`).join('\n')
  return NextResponse.json({
    success: true,
    count: analysis.items.length,
    summary: `${analysis.items.length}개 항목으로 정리됐습니다:\n${summary}`,
  })
}
