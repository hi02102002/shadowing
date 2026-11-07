/**
 * Nội dung trang "Shadowing là gì?": 4 trụ cột của shadowing (âm, trọng âm, ngữ điệu, nhịp điệu)
 * kèm câu ví dụ để nghe mẫu và luyện. Dữ liệu thuần, không cần DB.
 */
import type { DrillFocus } from '#/server/ai/prompts'

export type PillarId = DrillFocus

export interface PillarExample {
  /** câu đọc (không có dấu đánh dấu) */
  text: string
  /** lưu ý riêng của câu, gửi cho AI khi chấm */
  note?: string
}

export interface StressSentence {
  /** chỉ số từ được nhấn trong câu (tính từ 0) */
  stressed: number
  /** ý nghĩa khi nhấn từ đó */
  meaning: string
}

export type IntonationDirection = 'rise' | 'fall' | 'rise-tag'

export interface IntonationExample extends PillarExample {
  direction: IntonationDirection
  /** từ mang nhấn chính (nếu có) */
  stressed?: number
}

export interface RhythmExample extends PillarExample {
  /** các cụm đọc liền; nối lại bằng dấu cách phải ra đúng `text` */
  chunks: string[]
}

export const SOUND_EXAMPLES: Array<PillarExample & { focus: string }> = [
  {
    text: 'I need some water',
    focus: 'nguyên âm /iː/ trong need, âm cuối /d/ và /t/ của need, water',
  },
  {
    text: 'She likes this book',
    focus: 'âm cuối /s/ của likes, /s/ của this, /k/ của book',
  },
  {
    text: 'He has short black hair',
    focus: 'cụm phụ âm /ʃ/ + /rt/ ở short và /bl/ + /k/ ở black',
  },
]

/** từ nhiều âm tiết: trọng âm lấy từ từ điển CMU lúc hiển thị (có dấu ˈ trên IPA) */
export const STRESS_WORDS = ['appearance', 'happy', 'shoulder'] as const

export const STRESS_BASE = 'I really like this movie'

export const STRESS_SENTENCES: StressSentence[] = [
  {
    stressed: 1,
    meaning: 'Rất thích, nhấn mức độ: không phải thích bình thường.',
  },
  {
    stressed: 2,
    meaning: 'Thích chứ không phải ghét hay chỉ thấy bình thường.',
  },
  { stressed: 3, meaning: 'Phim NÀY, không phải phim khác.' },
  {
    stressed: 4,
    meaning: 'Thích bộ phim, chứ không phải cuốn sách hay bài hát.',
  },
]

export const INTONATION_EXAMPLES: IntonationExample[] = [
  {
    text: 'Are you ready?',
    direction: 'rise',
    stressed: 2,
    note: 'Câu hỏi Yes/No: lên giọng ở cuối câu, nhấn từ "ready".',
  },
  {
    text: "That's amazing!",
    direction: 'fall',
    stressed: 1,
    note: 'Câu cảm thán: nhấn "amazing" rồi xuống giọng.',
  },
  {
    text: "You're coming with us, right?",
    direction: 'rise-tag',
    note: 'Câu hỏi đuôi xin xác nhận: lên giọng ở "right".',
  },
]

export const RHYTHM_EXAMPLES: RhythmExample[] = [
  { text: 'I need to call my mom', chunks: ['I', 'need', 'to call', 'my mom'] },
  {
    text: 'She has long straight brown hair',
    chunks: ['She has', 'long', 'straight', 'brown hair'],
  },
]

/** bộ câu ví dụ cho cả 4 trụ cột: mặc định là bộ soạn sẵn ở trên, hoặc AI soạn theo chủ đề lộ trình */
export interface ShadowingSet {
  sound: Array<PillarExample & { focus: string }>
  stressWords: string[]
  stressBase: string
  stressSentences: StressSentence[]
  intonation: IntonationExample[]
  rhythm: RhythmExample[]
}

export const DEFAULT_SHADOWING_SET: ShadowingSet = {
  sound: SOUND_EXAMPLES,
  stressWords: [...STRESS_WORDS],
  stressBase: STRESS_BASE,
  stressSentences: STRESS_SENTENCES,
  intonation: INTONATION_EXAMPLES,
  rhythm: RHYTHM_EXAMPLES,
}

export const SHADOWING_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type ShadowingLevel = (typeof SHADOWING_LEVELS)[number]

export interface Pillar {
  id: PillarId
  /** nhãn tiếng Anh như trong slide */
  label: string
  vi: string
  summary: string
  tips: string[]
}

export const PILLARS: Pillar[] = [
  {
    id: 'sound',
    label: 'Sound',
    vi: 'Âm thanh',
    summary:
      'Phát âm đúng từng âm: nguyên âm, phụ âm và đặc biệt là âm cuối mà tiếng Việt hay bỏ.',
    tips: [
      'Nghe kỹ âm cuối (s, t, d, k…): người Việt hay nuốt, nhưng người bản xứ dùng nó để phân biệt từ.',
      'Đọc chậm từng từ trước, rồi mới đọc cả câu theo giọng mẫu.',
    ],
  },
  {
    id: 'stress',
    label: 'Stress',
    vi: 'Trọng âm',
    summary:
      'Mỗi từ nhiều âm tiết có một âm tiết đọc mạnh hơn, và trong câu có từ được nhấn để chuyển ý chính.',
    tips: [
      'Trọng âm từ: âm tiết mạnh to hơn, dài hơn, rõ nguyên âm; các âm tiết còn lại đọc nhẹ.',
      'Trọng âm câu: nhấn từ mang nghĩa (danh từ, động từ, tính từ), đọc nhẹ và nhanh các từ chức năng.',
      'Đổi từ được nhấn là đổi ý của câu.',
    ],
  },
  {
    id: 'intonation',
    label: 'Intonation',
    vi: 'Ngữ điệu',
    summary:
      'Giọng lên xuống trong một câu cho biết đó là câu hỏi, câu khẳng định, cảm thán hay đang xin xác nhận.',
    tips: [
      'Câu hỏi Yes/No và câu hỏi đuôi xin xác nhận thường lên giọng ở cuối.',
      'Câu khẳng định, câu hỏi Wh- và câu cảm thán thường xuống giọng ở cuối.',
      'Nghe bản mẫu, hát theo đường giọng trước khi tập đọc.',
    ],
  },
  {
    id: 'rhythm',
    label: 'Rhythm',
    vi: 'Nhịp điệu',
    summary:
      'Tiếng Anh nói theo cụm: đọc liền trong cụm, ngắt giữa các cụm, các từ chức năng đọc lướt nhẹ.',
    tips: [
      'Chia câu thành các cụm nghĩa nhỏ rồi đọc liền từng cụm, đừng đọc từng từ rời.',
      'Giữ nhịp đều: các từ mang nghĩa rơi vào nhịp, từ chức năng (to, my, a…) nén lại giữa các nhịp.',
    ],
  },
]

/** ghép các cụm thành câu có dấu "/" như trong slide: "I/ need/ to call/ my mom" */
export const chunkMarked = (chunks: string[]) => chunks.join('/ ')

/** câu "I REALLY like this movie": viết hoa từ được nhấn */
export function stressVariant(base: string, stressed: number): string {
  return base
    .split(' ')
    .map((w, i) => (i === stressed ? w.toUpperCase() : w))
    .join(' ')
}

const PILLAR_OF_MISTAKE: Record<string, PillarId> = {
  vowel: 'sound',
  consonant: 'sound',
  ending_sound: 'sound',
  weak_form: 'sound',
  homophone: 'sound',
  stress: 'stress',
  intonation: 'intonation',
  rhythm: 'rhythm',
  linking: 'rhythm',
  elision: 'rhythm',
  contraction: 'rhythm',
}

/** loại lỗi AI trả về → trụ cột của shadowing; null với lỗi không thuộc trụ cột nào (từ vựng, ngữ pháp…) */
export const pillarOfMistake = (type: string): PillarId | null =>
  PILLAR_OF_MISTAKE[type] ?? null

/** đầu ra thô của AI (xem ShadowingSetSchema) */
export interface RawShadowingSet {
  sound: Array<{ text: string; focus: string }>
  stressWords: string[]
  stressBase: string
  stressSentences: Array<{ stressed: number; meaning: string }>
  intonation: Array<{
    text: string
    direction: IntonationDirection
    stressed: number | null
    note: string
  }>
  rhythm: Array<{ chunks: string[] }>
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean)
const inRange = (i: number | null | undefined, text: string) =>
  i != null && Number.isInteger(i) && i >= 0 && i < words(text).length

/**
 * Làm sạch bộ câu AI soạn: bỏ câu rỗng, chỉ số nhấn lệch câu, cụm rỗng; câu nhịp điệu dựng lại từ các cụm
 * để luôn khớp. Phần nào AI trả thiếu thì dùng lại phần mặc định.
 */
export function normalizeShadowingSet(raw: RawShadowingSet): ShadowingSet {
  const d = DEFAULT_SHADOWING_SET
  const sound = raw.sound
    .map((x) => ({ text: x.text.trim(), focus: x.focus.trim() }))
    .filter((x) => x.text)
  const stressWords = raw.stressWords
    .map((w) => w.trim().replace(/[^A-Za-z'-]/g, ''))
    .filter(Boolean)
  const stressBase = raw.stressBase.trim()
  const stressSentences = raw.stressSentences.filter(
    (s, i, all) =>
      inRange(s.stressed, stressBase) &&
      all.findIndex((o) => o.stressed === s.stressed) === i,
  )
  const intonation = raw.intonation
    .map((x) => ({
      text: x.text.trim(),
      direction: x.direction,
      stressed: inRange(x.stressed, x.text) ? (x.stressed ?? undefined) : undefined,
      note: x.note.trim(),
    }))
    .filter((x) => x.text)
  const rhythm = raw.rhythm
    .map((x) => x.chunks.map((c) => c.trim()).filter(Boolean))
    .filter((chunks) => chunks.length > 1)
    .map((chunks) => ({ text: chunks.join(' '), chunks }))
  const useStress = stressBase && stressSentences.length >= 2
  return {
    sound: sound.length ? sound : d.sound,
    stressWords: stressWords.length ? stressWords : d.stressWords,
    stressBase: useStress ? stressBase : d.stressBase,
    stressSentences: useStress ? stressSentences : d.stressSentences,
    intonation: intonation.length ? intonation : d.intonation,
    rhythm: rhythm.length ? rhythm : d.rhythm,
  }
}
