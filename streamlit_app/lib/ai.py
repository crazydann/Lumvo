import os
import json
import tempfile
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

SYSTEM_PROMPT = """당신은 개인 비서입니다. 사용자의 메모를 분석하여 JSON 형식으로 정리해 주세요.

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
      "context": "work" | "personal",
      "type": "todo" | "idea" | "schedule" | "note",
      "content": "정리된 내용",
      "due_date": "YYYY-MM-DDTHH:mm:ss"
    }
  ]
}
due_date는 일정이 있을 경우만 포함하세요."""


def transcribe_audio(audio_bytes: bytes, filename: str = "memo.webm") -> str:
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_bytes)
        f.flush()
        with open(f.name, "rb") as audio_file:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=(filename, audio_file, "audio/webm"),
                language="ko",
            )
    return result.text


def analyze_memo(text: str) -> list[dict]:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
    )
    result = json.loads(response.choices[0].message.content)
    return result.get("items", [])
