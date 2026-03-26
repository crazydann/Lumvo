import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { AnalysisResult } from '@/lib/types'

const SYSTEM_PROMPT = `당신은 개인 비서입니다. 사용자의 메모를 분석하여 JSON 형식으로 정리해 주세요.

각 항목을 다음 기준으로 분류하세요:
- context: "work"(업무) 또는 "personal"(개인)
- type: "todo"(할 일), "idea"(아이디어), "schedule"(일정), "note"(메모)

할 일 예시: "김철수에게 메일 보내기" → type: "todo", "회의 준비하기" → type: "todo"
일정 예시: "다음주 월요일 팀 미팅" → type: "schedule"
아이디어 예시: "앱에 다크모드 추가하면 좋을 것 같다" → type: "idea"
메모 예시: 정보성 내용 → type: "note"

업무 관련 키워드: 회의, 보고서, 클라이언트, 팀, 프로젝트, 업무, 사무실, 동료 이름+업무
개인 관련 키워드: 가족, 친구, 개인 약속, 취미, 건강, 쇼핑

하나의 메모에서 여러 항목을 추출할 수 있습니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "items": [
    {
      "context": "work" | "personal",
      "type": "todo" | "idea" | "schedule" | "note",
      "content": "정리된 내용",
      "due_date": "YYYY-MM-DDTHH:mm:ss" (일정이 있을 경우만, 없으면 생략)
    }
  ]
}`

export async function POST(req: NextRequest) {
  const { text } = await req.json()

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(completion.choices[0].message.content!) as AnalysisResult

  return NextResponse.json(result)
}
