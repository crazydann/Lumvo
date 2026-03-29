import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { supabase } from '@/lib/supabase'
import { generateEmbedding, searchSimilarItems } from '@/lib/embeddings'
import { getAllMemory, upsertMemory } from '@/lib/memory'

const BRAIN_PROMPT = `당신은 사용자의 개인 AI 비서입니다. 사용자의 모든 메모, 할 일, 아이디어를 기반으로 통합적인 인사이트를 제공합니다.

다음 정보를 바탕으로 분석해 주세요:
1. 장기 기억 (과거 패턴, 주요 관심사, 인물 관계)
2. 최근 관련 항목들 (벡터 검색 결과)
3. 새로운 질문/메모

응답은 반드시 다음 JSON 형식으로:
{
  "answer": "질문에 대한 직접적인 답변",
  "focus": ["지금 당장 집중해야 할 것 1", "2", "3"],
  "insights": "패턴이나 연결고리 등 인사이트",
  "update_memory": {
    "summary": "전체 상황 요약 (업데이트 필요시)",
    "people": "주요 인물들 정보 (업데이트 필요시)",
    "projects": "진행 중인 프로젝트들 (업데이트 필요시)",
    "patterns": "발견된 패턴 (업데이트 필요시)"
  }
}
update_memory는 실제로 업데이트가 필요한 필드만 포함하세요.`

// GET: 브레인 현황 조회 (오늘의 브리핑)
export async function GET() {
  // 최근 항목들 가져오기
  const { data: recentItems } = await supabase
    .from('items')
    .select('content, type, context, is_done, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  // 장기 기억 로드
  const memory = await getAllMemory()

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  const prompt = `오늘은 ${todayStr}입니다.

=== 장기 기억 ===
${memory.summary ? `전체 요약: ${memory.summary}` : '(아직 없음)'}
${memory.people ? `주요 인물: ${memory.people}` : ''}
${memory.projects ? `진행 프로젝트: ${memory.projects}` : ''}
${memory.patterns ? `패턴: ${memory.patterns}` : ''}

=== 최근 항목 ===
${recentItems?.map(i => `[${i.context}/${i.type}] ${i.content} ${i.is_done ? '(완료)' : ''}`).join('\n') ?? '없음'}

오늘의 브리핑을 해주세요. 지금 가장 중요한 것과 집중해야 할 것을 알려주세요.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: BRAIN_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(completion.choices[0].message.content!)

  // 장기 기억 업데이트
  if (result.update_memory) {
    const updates = result.update_memory as Record<string, string>
    await Promise.allSettled(
      Object.entries(updates)
        .filter(([, v]) => v)
        .map(([type, content]) =>
          upsertMemory(type as 'summary' | 'people' | 'projects' | 'patterns', content)
        )
    )
  }

  return NextResponse.json({
    answer: result.answer,
    focus: result.focus ?? [],
    insights: result.insights,
    generated_at: new Date().toISOString(),
  })
}

// POST: 특정 질문으로 브레인에 질의
export async function POST(req: NextRequest) {
  const { query } = await req.json()

  if (!query?.trim()) {
    return NextResponse.json({ error: 'No query provided' }, { status: 400 })
  }

  // 벡터 검색으로 관련 항목 찾기
  const queryEmbedding = await generateEmbedding(query)
  const similarItems = await searchSimilarItems(queryEmbedding, 8)

  // 장기 기억 로드
  const memory = await getAllMemory()

  const prompt = `=== 장기 기억 ===
${memory.summary ? `전체 요약: ${memory.summary}` : '(아직 없음)'}
${memory.people ? `주요 인물: ${memory.people}` : ''}
${memory.projects ? `진행 프로젝트: ${memory.projects}` : ''}
${memory.patterns ? `패턴: ${memory.patterns}` : ''}

=== 관련 항목 (유사도 검색) ===
${similarItems.length > 0
  ? similarItems.map(i => `[${i.context}/${i.type}, 유사도:${(i.similarity * 100).toFixed(0)}%] ${i.content}`).join('\n')
  : '관련 항목 없음'}

=== 질문 ===
${query}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: BRAIN_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(completion.choices[0].message.content!)

  // 장기 기억 업데이트
  if (result.update_memory) {
    const updates = result.update_memory as Record<string, string>
    await Promise.allSettled(
      Object.entries(updates)
        .filter(([, v]) => v)
        .map(([type, content]) =>
          upsertMemory(type as 'summary' | 'people' | 'projects' | 'patterns', content)
        )
    )
  }

  return NextResponse.json({
    answer: result.answer,
    focus: result.focus ?? [],
    insights: result.insights,
    related_count: similarItems.length,
  })
}
