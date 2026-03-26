export type Context = 'work' | 'personal'
export type ItemType = 'todo' | 'idea' | 'schedule' | 'note'

export interface Memo {
  id: string
  raw_text: string
  audio_url?: string
  created_at: string
}

export interface Item {
  id: string
  memo_id: string
  context: Context
  type: ItemType
  content: string
  is_done: boolean
  due_date?: string
  created_at: string
}

export interface AnalysisResult {
  items: {
    context: Context
    type: ItemType
    content: string
    due_date?: string
  }[]
}
