import type { ReadingQuestion } from '#/db/schema'

export const LISTENING_SOURCES = [
  'cambridge-listening',
  'tactics',
  'breaking-news',
  'ee-blog',
  'elllo',
] as const
export type ListeningSource = (typeof LISTENING_SOURCES)[number]

export const LISTENING_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type ListeningLevel = (typeof LISTENING_LEVELS)[number]

export const LISTENING_FORMATS = ['standard', 'ielts'] as const
export type ListeningFormat = (typeof LISTENING_FORMATS)[number]

export const LISTENING_SOURCE_INFO: Record<
  ListeningSource,
  { label: string; detail: string; home: string; originalQuestions: boolean }
> = {
  'cambridge-listening': {
    label: 'Cambridge IELTS',
    detail: 'Đề IELTS Listening, 4 section và đáp án gốc',
    home: 'https://www.essentialenglish.review/',
    originalQuestions: true,
  },
  tactics: {
    label: 'Tactics for Listening',
    detail: 'Bài nghe theo unit và track, có bài tập gốc',
    home: 'https://www.essentialenglish.review/',
    originalQuestions: true,
  },
  'breaking-news': {
    label: 'Breaking News English',
    detail: 'Tin ngắn chia cấp độ; câu hỏi do AI soạn',
    home: 'https://breakingnewsenglish.com/',
    originalQuestions: false,
  },
  'ee-blog': {
    label: 'English Listening',
    detail: 'Bài nghe và lời thoại từ Essential English Blog',
    home: 'https://www.essentialenglish.review/',
    originalQuestions: false,
  },
  elllo: {
    label: 'ELLLO',
    detail: 'Hội thoại thực tế theo cấp độ, có quiz gốc',
    home: 'https://elllo.org/',
    originalQuestions: true,
  },
}

export type ListeningMedia =
  { kind: 'audio'; url: string } | { kind: 'vimeo'; id: string }

export interface ListeningSection {
  title: string
  media: ListeningMedia | null
  transcript: string[] | null
  questions: ReadingQuestion[]
}

export interface ListeningLibraryItem {
  source: ListeningSource
  url: string
  title: string
  levels: ListeningLevel[]
  levelLabel: string
  date?: string
}
