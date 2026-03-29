-- ================================================================
-- Lumvo Brain Schema - Supabase SQL Editor에서 실행
-- ================================================================

-- 1. pgvector 확장 활성화
create extension if not exists vector;

-- 2. items 테이블에 embedding 컬럼 추가
alter table items add column if not exists embedding vector(1536);

-- 3. 장기 기억 테이블
create table if not exists memory (
  id uuid default gen_random_uuid() primary key,
  type text not null unique,  -- 'summary', 'people', 'projects', 'patterns'
  content text not null,
  updated_at timestamp with time zone default now()
);

alter table memory disable row level security;

-- 4. 벡터 유사도 검색 함수
create or replace function match_items(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.3
)
returns table (
  id uuid,
  content text,
  type text,
  context text,
  is_done boolean,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    type,
    context,
    is_done,
    created_at,
    1 - (embedding <=> query_embedding) as similarity
  from items
  where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 5. embedding 인덱스 (HNSW - 빠른 근사 검색)
create index if not exists items_embedding_idx
  on items using hnsw (embedding vector_cosine_ops);
