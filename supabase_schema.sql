-- Supabase에서 실행할 SQL 스키마

-- 원본 메모 테이블 (음성/텍스트 입력 원본)
create table memos (
  id uuid default gen_random_uuid() primary key,
  raw_text text not null,
  audio_url text,
  created_at timestamp with time zone default now()
);

-- AI 분석 후 정리된 항목 테이블
create table items (
  id uuid default gen_random_uuid() primary key,
  memo_id uuid references memos(id) on delete cascade,
  context text not null check (context in ('work', 'personal')),
  type text not null check (type in ('todo', 'idea', 'schedule', 'note')),
  content text not null,
  is_done boolean default false,
  due_date timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 실시간 구독을 위한 Realtime 활성화
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table memos;

-- 인덱스
create index items_context_idx on items(context);
create index items_type_idx on items(type);
create index items_is_done_idx on items(is_done);
create index items_created_at_idx on items(created_at desc);
