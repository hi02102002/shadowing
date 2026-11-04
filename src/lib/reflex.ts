/** Luyện phản xạ nói (trang /reflex): dạng bài, nguồn đề, cấp độ — dùng chung client và server */

export const REFLEX_MODES = ['translate', 'qa', 'situation', 'pattern'] as const
export type ReflexMode = (typeof REFLEX_MODES)[number]

export const REFLEX_MODE_INFO: Record<
  ReflexMode,
  { label: string; detail: string }
> = {
  translate: {
    label: 'Dịch nói Việt → Anh',
    detail: 'Thấy câu tiếng Việt, nói ngay câu tiếng Anh tương ứng',
  },
  qa: {
    label: 'Hỏi nhanh – đáp nhanh',
    detail: 'Nghe câu hỏi tiếng Anh, trả lời ngay 1–2 câu',
  },
  situation: {
    label: 'Phản xạ tình huống',
    detail: 'Đọc tình huống, nói câu phù hợp như ngoài đời',
  },
  pattern: {
    label: 'Phản xạ mẫu câu',
    detail: 'Ghép từ gợi ý vào mẫu câu, nói thật nhanh',
  },
}

export const REFLEX_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type ReflexLevel = (typeof REFLEX_LEVELS)[number]

export const REFLEX_SOURCES = ['bank', 'tatoeba', 'iteslj', 'ai'] as const
export type ReflexSource = (typeof REFLEX_SOURCES)[number]

export const REFLEX_SOURCE_INFO: Record<
  ReflexSource,
  { label: string; detail: string; modes: readonly ReflexMode[] }
> = {
  bank: {
    label: 'Bộ câu có sẵn',
    detail: 'Câu soạn sẵn theo cấp độ, không cần AI để ra đề',
    modes: REFLEX_MODES,
  },
  tatoeba: {
    label: 'Tatoeba',
    detail: 'Hơn 30.000 cặp câu Việt–Anh do cộng đồng dịch (CC BY 2.0 FR)',
    modes: ['translate'],
  },
  iteslj: {
    label: 'iTESLj Conversation Questions',
    detail: 'Hàng nghìn câu hỏi hội thoại theo hơn 200 chủ đề',
    modes: ['qa'],
  },
  ai: {
    label: 'AI soạn đề',
    detail: 'AI tạo bộ câu theo chủ đề và cấp độ bạn chọn',
    modes: REFLEX_MODES,
  },
}

/** nhãn cho giá trị đọc từ DB (chuỗi bất kỳ) */
export const modeLabel = (mode: string) =>
  (REFLEX_MODE_INFO as Partial<Record<string, { label: string }>>)[mode]
    ?.label ?? mode
export const sourceLabel = (source: string) =>
  (REFLEX_SOURCE_INFO as Partial<Record<string, { label: string }>>)[source]
    ?.label ?? source

export const sourcesFor = (mode: ReflexMode) =>
  REFLEX_SOURCES.filter((s) => REFLEX_SOURCE_INFO[s].modes.includes(mode))

export const REFLEX_COUNTS = [5, 10, 15, 20] as const

/** giây được nói mỗi câu, mặc định theo dạng bài và cấp độ */
export function defaultAnswerSeconds(mode: ReflexMode, level: ReflexLevel) {
  const base = { A1: 6, A2: 7, B1: 8, B2: 10, C1: 12 }[level]
  const extra = { translate: 0, qa: 2, situation: 4, pattern: -1 }[mode]
  return base + extra
}
export const MIN_ANSWER_SECONDS = 3
export const MAX_ANSWER_SECONDS = 30

/** một câu đề: prompt là thứ người học thấy/nghe, reference là câu mẫu (nếu có) */
export interface ReflexPrompt {
  prompt: string
  /** ngôn ngữ của prompt: câu hỏi tiếng Anh thì đọc to được */
  promptLang: 'vi' | 'en'
  /** dạng mẫu câu: từ cần ghép vào; tình huống: gợi ý ngắn */
  hint?: string | null
  reference?: string | null
  /** ghi nguồn (Tatoeba: tác giả câu và giấy phép) */
  attribution?: string | null
}

/** CEFR ước lượng theo độ dài câu (số từ tiếng Anh) */
export function levelByLength(words: number): ReflexLevel {
  if (words <= 5) return 'A1'
  if (words <= 8) return 'A2'
  if (words <= 12) return 'B1'
  if (words <= 18) return 'B2'
  return 'C1'
}

export const wordCount = (s: string) =>
  s.trim().split(/\s+/).filter(Boolean).length

/** khoảng số từ ứng với một cấp độ (ngược với levelByLength) */
export const LEVEL_WORD_RANGE: Record<ReflexLevel, [number, number]> = {
  A1: [2, 5],
  A2: [6, 8],
  B1: [9, 12],
  B2: [13, 18],
  C1: [19, 40],
}

/** bốc ngẫu nhiên n phần tử không trùng */
export function sample<T>(list: readonly T[], n: number, rand = Math.random) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}
