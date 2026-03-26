import streamlit as st
from lib.ai import transcribe_audio, analyze_memo
from lib.db import fetch_items, save_memo_with_items, toggle_item

st.set_page_config(
    page_title="Lumvo",
    page_icon="🧠",
    layout="wide",
)

# ── 스타일 ──────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    .main { padding-top: 1rem; }
    .block-container { padding-top: 1rem; max-width: 1100px; }
    .item-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 10px 14px;
        margin-bottom: 6px;
        font-size: 14px;
    }
    .item-done { opacity: 0.45; text-decoration: line-through; }
    .badge {
        display: inline-block;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 99px;
        font-weight: 600;
        margin-right: 6px;
    }
    .badge-todo { background:#dbeafe; color:#1d4ed8; }
    .badge-idea { background:#fef9c3; color:#854d0e; }
    .badge-schedule { background:#dcfce7; color:#166534; }
    .badge-note { background:#f3f4f6; color:#374151; }
    h1 { font-size: 1.6rem !important; margin-bottom: 0 !important; }
    .stButton button { border-radius: 99px !important; }
</style>
""", unsafe_allow_html=True)

# ── 세션 상태 ────────────────────────────────────────────────────────────────
if "items" not in st.session_state:
    st.session_state.items = []
if "filter_type" not in st.session_state:
    st.session_state.filter_type = "전체"
if "filter_context" not in st.session_state:
    st.session_state.filter_context = "전체"


def reload_items():
    context_map = {"업무": "work", "개인": "personal", "전체": None}
    type_map = {"할 일": "todo", "아이디어": "idea", "일정": "schedule", "메모": "note", "전체": None}
    st.session_state.items = fetch_items(
        context=context_map[st.session_state.filter_context],
        item_type=type_map[st.session_state.filter_type],
    )


def process_memo(text: str):
    with st.spinner("AI가 분석 중..."):
        items = analyze_memo(text)
        save_memo_with_items(text, items)
    reload_items()
    return len(items)


# ── 헤더 ─────────────────────────────────────────────────────────────────────
col_title, col_badge = st.columns([4, 1])
with col_title:
    st.markdown("# 🧠 Lumvo")
    st.caption("생각날 때 바로 기록 → AI가 자동 정리")

pending_todos = sum(1 for i in st.session_state.items if i["type"] == "todo" and not i["is_done"])
if pending_todos:
    col_badge.metric("미완료 할 일", pending_todos)

st.divider()

# ── 메모 입력 ─────────────────────────────────────────────────────────────────
with st.container():
    st.subheader("✏️ 메모 추가")
    tab_text, tab_voice = st.tabs(["텍스트", "🎤 음성"])

    with tab_text:
        text_input = st.text_area(
            "메모를 입력하세요",
            placeholder="예: 김철수에게 제안서 메일 보내기, 다음주 월요일 팀 미팅",
            height=100,
            label_visibility="collapsed",
        )
        if st.button("저장 & 분석", type="primary", use_container_width=True):
            if text_input.strip():
                count = process_memo(text_input.strip())
                st.success(f"✅ {count}개 항목으로 정리됐습니다!")
                st.rerun()
            else:
                st.warning("메모를 입력해 주세요.")

    with tab_voice:
        st.info("🎤 아래 버튼으로 음성을 녹음하면 자동으로 텍스트로 변환됩니다.")
        audio = st.audio_input("음성 녹음")
        if audio:
            with st.spinner("음성을 텍스트로 변환 중..."):
                text = transcribe_audio(audio.read())
            st.text_area("변환된 텍스트", value=text, height=80)
            if st.button("저장 & 분석 ", type="primary", use_container_width=True):
                count = process_memo(text)
                st.success(f"✅ {count}개 항목으로 정리됐습니다!")
                st.rerun()

st.divider()

# ── 필터 & 새로고침 ──────────────────────────────────────────────────────────
col_f1, col_f2, col_refresh = st.columns([2, 2, 1])
with col_f1:
    ctx = st.selectbox("구분", ["전체", "업무", "개인"], key="filter_context")
with col_f2:
    typ = st.selectbox("유형", ["전체", "할 일", "아이디어", "일정", "메모"], key="filter_type")
with col_refresh:
    st.write("")
    if st.button("🔄 새로고침", use_container_width=True):
        reload_items()
        st.rerun()

# 최초 로드
if not st.session_state.items:
    reload_items()

# ── 대시보드 ──────────────────────────────────────────────────────────────────
st.subheader("📋 정리된 항목")

items = st.session_state.items
if not items:
    st.markdown(
        "<div style='text-align:center; color:#9ca3af; padding:60px 0'>아직 항목이 없습니다.<br>메모를 추가해 보세요!</div>",
        unsafe_allow_html=True,
    )
else:
    col_work, col_personal = st.columns(2)

    CONTEXT_COLS = {"work": col_work, "personal": col_personal}
    CONTEXT_LABELS = {"work": "💼 업무", "personal": "🏠 개인"}
    TYPE_BADGES = {
        "todo": ("badge-todo", "할 일"),
        "idea": ("badge-idea", "아이디어"),
        "schedule": ("badge-schedule", "일정"),
        "note": ("badge-note", "메모"),
    }
    TYPE_ICONS = {"todo": "☐", "idea": "💡", "schedule": "📅", "note": "📝"}

    for context in ["work", "personal"]:
        ctx_items = [i for i in items if i["context"] == context]
        with CONTEXT_COLS[context]:
            st.markdown(f"**{CONTEXT_LABELS[context]}** ({len(ctx_items)}개)")
            if not ctx_items:
                st.markdown(
                    "<div style='color:#d1d5db; font-size:13px; padding:20px 0 10px; text-align:center'>항목 없음</div>",
                    unsafe_allow_html=True,
                )
            for item in ctx_items:
                badge_cls, badge_label = TYPE_BADGES.get(item["type"], ("badge-note", "메모"))
                done_cls = "item-done" if item["is_done"] else ""

                c1, c2 = st.columns([5, 1])
                with c1:
                    due = ""
                    if item.get("due_date"):
                        from datetime import datetime
                        try:
                            dt = datetime.fromisoformat(item["due_date"].replace("Z", "+00:00"))
                            due = f'<div style="font-size:11px;color:#9ca3af;margin-top:2px">{dt.strftime("%m/%d %H:%M")}</div>'
                        except Exception:
                            pass
                    st.markdown(
                        f"""<div class="item-card {done_cls}">
                            <span class="badge {badge_cls}">{badge_label}</span>
                            {item['content']}{due}
                        </div>""",
                        unsafe_allow_html=True,
                    )
                with c2:
                    if item["type"] == "todo":
                        label = "✅" if item["is_done"] else "⬜"
                        if st.button(label, key=f"toggle_{item['id']}"):
                            toggle_item(item["id"], not item["is_done"])
                            reload_items()
                            st.rerun()
