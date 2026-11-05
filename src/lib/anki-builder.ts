/**
 * Trình tạo thẻ Anki từ bài học essentialenglish.review (bản tích hợp của repo essentialenglish2ank):
 * kiểu dữ liệu, danh sách sách có sẵn, tách danh sách từ tự do, ghép cụm từ vào từ gốc, URL giọng đọc / ảnh minh hoạ.
 */

export type PresetBook = {
  slug: string
  title: string
  level: string
  totalUnits: number
  category?: 'vocabulary' | 'grammar'
}

export type ExtractedVocabulary = {
  word: string
  image?: string
  pron?: string
  desc?: string
  exam?: string
  kind?: 'word' | 'phrase'
  hint?: string
}

export type ExtractedNote = {
  id: string
  title: string
  sectionLetter?: string
  content: string[]
  rawHtml?: string
}

export type LessonAnalysis = {
  sourceUrl: string
  resolvedUrl: string
  bookSlug?: string
  bookTitle?: string
  unitNumber: number
  unitTitle: string
  title: string
  words: string[]
  phrases: string[]
  vocabularyList: ExtractedVocabulary[]
  notes: ExtractedNote[]
  isGrammar?: boolean
}

export type LexicalChunk = {
  text: string
  ipa?: string
  meaningVi: string
  englishDefinition?: string
  example?: string
  imageQuery?: string
  imageUrl?: string
  partOfSpeech?: string
  audioUrl?: string
  exampleAudioUrl?: string
}

export type VocabularyCard = {
  type: 'vocabulary'
  id: string
  selected: boolean
  unitNumber?: number
  kind?: 'word' | 'phrase'
  partOfSpeech?: string
  hint?: string
  word: string
  maskedWord?: string
  ipa: string
  vietnamese: string
  englishDefinition: string
  example: string
  chunks?: LexicalChunk[]
  imageQuery: string
  imageUrl: string
  wordAudioUrl: string
  exampleAudioUrl: string
  sourceUrl: string
}

export type NoteCard = {
  type: 'note'
  id: string
  selected: boolean
  unitNumber?: number
  title: string
  content: string[]
  vietnameseExplanation: string
  example: string
  exampleAudioUrl: string
  sourceUrl: string
}

export type AnyAnkiCard = VocabularyCard | NoteCard

export type GeneratedVocabulary = Pick<
  VocabularyCard,
  'word' | 'ipa' | 'vietnamese' | 'englishDefinition' | 'example' | 'imageQuery'
> & {
  partOfSpeech?: string
  chunks?: LexicalChunk[]
}

export type GeneratedNote = {
  title: string
  content: string[]
  vietnameseExplanation: string
  example: string
}

export const PRESET_BOOKS: PresetBook[] = [
  {
    slug: 'english-vocabulary-in-use-pre-intermediate-and-intermediate',
    title: 'English Vocabulary in Use: Pre-intermediate & Intermediate',
    level: 'B1-B2',
    totalUnits: 100,
    category: 'vocabulary',
  },
  {
    slug: 'english-vocabulary-in-use-upper-intermediate',
    title: 'English Vocabulary in Use: Upper-intermediate',
    level: 'B2',
    totalUnits: 100,
    category: 'vocabulary',
  },
  {
    slug: 'english-vocabulary-in-use-elementary',
    title: 'English Vocabulary in Use: Elementary',
    level: 'A1-A2',
    totalUnits: 60,
    category: 'vocabulary',
  },
  {
    slug: 'english-vocabulary-in-use-advanced',
    title: 'English Vocabulary in Use: Advanced',
    level: 'C1-C2',
    totalUnits: 100,
    category: 'vocabulary',
  },
  {
    slug: 'english-grammar-in-use-with-answers',
    title: 'English Grammar in Use (5th Edition)',
    level: 'B1-B2',
    totalUnits: 152,
    category: 'grammar',
  },
]

export function parseCustomWords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\n,;\t]+/)
        .map((w) => w.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter((w) => w.length > 0),
    ),
  )
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stemWord(w: string): string {
  return w
    .toLowerCase()
    .trim()
    .replace(/(?:ing|ies|es|ed|s)$/i, '')
}

export function phraseContainsWord(phrase: string, word: string): boolean {
  const pLower = phrase.toLowerCase().trim()
  const wLower = word.toLowerCase().trim()
  if (pLower === wLower) return true

  // Match whole word with regular plural or inflection suffixes
  const regexExact = new RegExp(
    `\\b${escapeRegExp(wLower)}(?:s|es|ed|ing)?\\b`,
    'i',
  )
  if (regexExact.test(pLower)) return true

  // Match stem if stem length >= 3
  const wStem = stemWord(wLower)
  if (wStem.length >= 3) {
    const regexStem = new RegExp(`\\b${escapeRegExp(wStem)}[a-z]*\\b`, 'i')
    if (regexStem.test(pLower)) return true
  }
  return false
}

export function findMatchingWordForPhrase(
  phrase: string,
  candidateWords: string[],
): string | undefined {
  if (!phrase || !candidateWords.length) return undefined
  const pClean = phrase
    .toLowerCase()
    .replace(/^(?:to\s+(?:be\s+)?|a\s+|an\s+|the\s+|as\s+)/, '')
    .trim()

  // 1. If phrase begins with one of candidate words or stem (e.g. "shake hands with..." -> "shake")
  const firstWord = pClean.split(/\s+/)[0]
  for (const w of candidateWords) {
    const wLower = w.toLowerCase()
    if (wLower === firstWord || stemWord(wLower) === stemWord(firstWord)) {
      return w
    }
  }

  // 2. Check candidate words in candidateWords that match anywhere inside the phrase
  for (const w of candidateWords) {
    if (phraseContainsWord(phrase, w)) {
      return w
    }
  }

  return undefined
}

/** Youdao: type 1 = giọng Anh (UK) */
export const youdaoVoiceUrl = (text: string) =>
  text.trim()
    ? `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text.trim())}&type=1`
    : ''

const cleanImageQuery = (q: string) =>
  q
    .replace(/[()[\]{}"']/g, ' ')
    .replace(/[+&/\\#@!?,:;~^`|<>=*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function bingImageUrl(query: string, alt = false): string {
  const q = cleanImageQuery(query) || query.trim() || 'english vocabulary'
  return alt
    ? `https://tse1.mm.bing.net/th?${new URLSearchParams({ q, w: '480', h: '360', c: '7', rs: '1', p: '0' })}`
    : `https://th.bing.com/th?${new URLSearchParams({ q, c: '7', rs: '1', p: '0', o: '5', dpr: '2', pid: '1.7', mkt: 'en-WW', cc: 'VN', setlang: 'en', adlt: 'moderate', t: '1' })}`
}

/** từ loại viết tắt/tiếng Việt → mã chuẩn (noun, verb, phrase…) */
export function normalizePartOfSpeech(raw?: string): string {
  const c = (raw ?? '').toLowerCase().trim()
  if (!c) return ''
  if (/^adj\b|adjective|tính/.test(c)) return 'adjective'
  if (/^adv\b|adverb|trạng|phó/.test(c)) return 'adverb'
  if (/phrasal verb|^phr\.? ?v|cụm động/.test(c)) return 'phrasal verb'
  if (/^n\b|noun|danh/.test(c)) return 'noun'
  if (/^v\b|verb|động/.test(c)) return 'verb'
  if (/idiom|thành ngữ/.test(c)) return 'idiom'
  if (/phrase|^phr\b|cụm/.test(c)) return 'phrase'
  if (/^prep\b|preposition|giới/.test(c)) return 'preposition'
  if (/^conj\b|conjunction|liên/.test(c)) return 'conjunction'
  return c
}
