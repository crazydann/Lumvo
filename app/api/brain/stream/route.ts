import { NextRequest } from 'next/server'
import { openai } from '@/lib/openai'
import { supabase } from '@/lib/supabase'
import { generateEmbedding, searchSimilarItems } from '@/lib/embeddings'
import { getAllMemory, upsertMemory } from '@/lib/memory'
import { LIMITS } from '@/lib/api-security'

function encode(text: string) {
  return new TextEncoder().encode(`data: ${text}\n\n`)
}

async function buildBriefingPrompt() {
  const { data: recentItems } = await supabase
    .from('items')
    .select('content, type, context, is_done, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  const memory = await getAllMemory()
  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return {
    system: `당신은 사용자의 개인 AI 비서입니다. 자연스럽고 친근하게 한국어로 답변하세요.
답변 후 반드시 마지막에 다음 JSON을 별도 줄에 출력하세요:
[STRUCTURED]{"focus":["집중항목1","집중항목2","집중항목3"],"insights":"패턴이나 인사이트","memory_update":{"summary":"요약","people":"인물","projects":"프로젝트","patterns":"패턴"}}
memory_update는 실제 변경이 필요한 필드만 포함. focus는 최대 3개.`,
    user: `오늘은 ${todayStr}입니다.

=== 장기 기억 ===
${memory.summary ? `요약: ${memory.summary}` : '(없음)'}
${memory.people ? `인물: ${memory.people}` : ''}
${memory.projects ? `프로젝트: ${memory.projects}` : ''}
${memory.patterns ? `패턴: ${memory.patterns}` : ''}

=== 최근 항목 ===
${recentItems?.map(i => `[${i.context}/${i.type}] ${i.content}${i.is_done ? ' ✓' : ''}`).join('\n') ?? '없음'}

오늘의 브리핑을 해주세요.`,
  }
}

async function buildQueryPrompt(query: string) {
  const queryEmbedding = await generateEmbedding(query)
  const similarItems = await searchSimilarItems(queryEmbedding, 8)
  const memory = await getAllMemory()

  return {
    system: `당신은 사용자의 개인 AI 비서입니다. 자연스럽고 친근하게 한국어로 답변하세요.
답변 후 반드시 마지막에 다음 JSON을 별도 줄에 출력하세요:
[STRUCTURED]{"focus":["집중항목1","집중항목2"],"insights":"인사이트","memory_update":{}}
focus는 최대 3개, memory_update는 필요시만.`,
    user: `=== 장기 기억 ===
${memory.summary ? `요약: ${memory.summary}` : '(없음)'}
${memory.people ? `인물: ${memory.people}` : ''}
${memory.projects ? `프로젝트: ${memory.projects}` : ''}

=== 관련 항목 (${similarItems.length}개) ===
${similarItems.map(i => `[${i.context}/${i.type}] ${i.content}`).join('\n') || '없음'}

=== 질문 ===
${query}`,
  }
}

export async function GET() {
  const prompt = await buildBriefingPrompt()
  return streamResponse(prompt.system, prompt.user)
}

export async function POST(req: NextRequest) {
  const { query } = await req.json()
  if (!query?.trim()) {
    return new Response('No query', { status: 400 })
  }
  if (Buffer.byteLength(String(query), 'utf8') > LIMITS.MAX_QUERY_BYTES) {
    return new Response('Query too large', { status: 413 })
  }
  const prompt = await buildQueryPrompt(query)
  return streamResponse(prompt.system, prompt.user)
}

async function streamResponse(system: string, user: string) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          stream: true,
        })

        let fullText = ''

        for await (const chunk of completion) {
          const token = chunk.choices[0]?.delta?.content ?? ''
          if (!token) continue

          fullText += token

          // [STRUCTURED] 이전 텍스트만 스트리밍
          if (!fullText.includes('[STRUCTURED]')) {
            controller.enqueue(encode(token))
          }
        }

        // [STRUCTURED] JSON 파싱 후 전송
        const structuredIdx = fullText.indexOf('[STRUCTURED]')
        if (structuredIdx !== -1) {
          const jsonStr = fullText.slice(structuredIdx + 12).trim()
          try {
            const structured = JSON.parse(jsonStr)
            controller.enqueue(encode(`[STRUCTURED]${JSON.stringify(structured)}`))

            // 장기 기억 업데이트
            if (structured.memory_update) {
              await Promise.allSettled(
                Object.entries(structured.memory_update as Record<string, string>)
                  .filter(([, v]) => v)
                  .map(([type, content]) =>
                    upsertMemory(type as 'summary' | 'people' | 'projects' | 'patterns', content)
                  )
              )
            }
          } catch {
            // JSON 파싱 실패 시 무시
          }
        }

        controller.enqueue(encode('[DONE]'))
        controller.close()
      } catch (e) {
        console.error('Stream error:', e)
        controller.enqueue(encode('[ERROR]'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
