export const CHUNK_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type ChunkLevel = (typeof CHUNK_LEVELS)[number]

export const CHUNK_TOPICS = [
  'daily-life',
  'work',
  'travel',
  'study',
  'communication',
  'opinions',
] as const
export type ChunkTopic = (typeof CHUNK_TOPICS)[number]

export const CHUNK_TOPIC_LABELS: Record<ChunkTopic, string> = {
  'daily-life': 'Đời sống',
  work: 'Công việc',
  travel: 'Du lịch',
  study: 'Học tập',
  communication: 'Giao tiếp',
  opinions: 'Trình bày ý kiến',
}

export const CHUNK_KINDS = [
  'formula',
  'sentence-frame',
  'collocation',
  'phrasal-verb',
  'discourse-marker',
] as const
export type ChunkKind = (typeof CHUNK_KINDS)[number]

export const CHUNK_KIND_LABELS: Record<ChunkKind, string> = {
  formula: 'Cụm cố định',
  'sentence-frame': 'Khung câu',
  collocation: 'Collocation',
  'phrasal-verb': 'Phrasal verb',
  'discourse-marker': 'Từ nối',
}

export interface ChunkAttribution {
  source: string
  sourceId: string | null
  sourceUrl: string
  author: string | null
  license: string
  attribution: string
  role:
    | 'content'
    | 'translation'
    | 'example'
    | 'audio'
    | 'level'
    | 'frequency'
    | 'sense'
}

/** câu ví dụ Tatoeba nguyên văn (id để mở trang gốc) */
export interface ChunkExample {
  en: string
  vi: string
  enId: string
  viId: string
}

export interface ChunkSeed {
  id: string
  text: string
  normalizedText: string
  sense: string
  /** định nghĩa tiếng Anh từ nguồn (Open English WordNet); null với câu Tatoeba */
  definitionEn: string | null
  level: ChunkLevel
  topic: ChunkTopic
  kind: ChunkKind
  frequency: number
  /** nghĩa tiếng Việt có nguồn; cụm từ WordNet / khung câu không có (tiếng Việt nằm ở câu ví dụ) */
  meaningVi: string | null
  exampleEn: string
  exampleVi: string
  /** thêm câu ví dụ (cụm từ); rỗng với câu Tatoeba */
  examples: ChunkExample[]
  /** dạng chuẩn hoá để nhận diện cụm trong bài (rỗng với câu Tatoeba nguyên câu) */
  forms: string[]
  audioUrl: string | null
  sourceVerified: true
  reviewed: boolean
  attributions: ChunkAttribution[]
}

export interface ChunkSourceInfo {
  id: string
  name: string
  homepage: string
  license: string
  usage: 'active' | 'supported' | 'reference-only'
  noteVi: string
}
