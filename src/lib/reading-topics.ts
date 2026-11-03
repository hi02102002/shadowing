/** Chủ đề, trình độ, dạng câu hỏi và cách chấm cho trang Đọc hiểu (/reading), dùng chung client và server */
import type { ReadingQuestion } from '#/db/schema.ts'
import { matchesAnswer, normalizeAnswer } from './grammar-check.ts'

export const READING_LEVELS = ['A2', 'B1', 'B2', 'C1'] as const
export type ReadingLevel = (typeof READING_LEVELS)[number]

export const READING_LEVEL_LABEL: Record<ReadingLevel, string> = {
  A2: 'A2 · Sơ cấp',
  B1: 'B1 · Trung cấp',
  B2: 'B2 · Trung cao cấp',
  C1: 'C1 · Cao cấp',
}

/**
 * dạng câu hỏi AI soạn được: trắc nghiệm, True/False/Not Given, Yes/No/Not Given (quan điểm tác giả),
 * nối tiêu đề với đoạn, điền từ lấy trong bài, trả lời ngắn
 */
export const AI_QUESTION_TYPES = ['choice', 'tfng', 'ynng', 'heading', 'gap', 'short'] as const
export type AiQuestionType = (typeof AI_QUESTION_TYPES)[number]
/** thêm "chọn nhiều đáp án" (Choose TWO letters) chỉ có ở đề gốc */
export const READING_QUESTION_TYPES = [...AI_QUESTION_TYPES, 'multi'] as const
export type ReadingQuestionType = (typeof READING_QUESTION_TYPES)[number]

export const READING_QUESTION_TYPE_LABEL: Record<ReadingQuestionType, string> = {
  choice: 'Trắc nghiệm',
  tfng: 'True / False / Not Given',
  ynng: 'Yes / No / Not Given',
  heading: 'Nối tiêu đề với đoạn',
  gap: 'Điền từ',
  short: 'Trả lời ngắn',
  multi: 'Chọn nhiều đáp án',
}

/** hướng dẫn đầu mỗi nhóm câu cùng dạng, như trong đề thi */
export const READING_QUESTION_INSTRUCTION: Record<ReadingQuestionType, string> = {
  choice: 'Choose the correct answer.',
  tfng: 'Do the following statements agree with the information in the text? Choose TRUE, FALSE or NOT GIVEN.',
  ynng: "Do the following statements agree with the views of the writer? Choose YES, NO or NOT GIVEN.",
  heading: 'Choose the correct heading for each paragraph from the list of headings.',
  gap: 'Complete the sentences. Choose NO MORE THAN TWO WORDS from the text for each answer.',
  short: 'Answer the questions. Choose NO MORE THAN THREE WORDS from the text for each answer.',
  multi: 'Choose the correct letters.',
}

/** dạng đề: bài tập thường, IELTS Academic Reading, TOEIC Reading Part 7 */
export const READING_FORMATS = ['standard', 'ielts', 'toeic'] as const
export type ReadingFormat = (typeof READING_FORMATS)[number]

export const READING_FORMAT_INFO: Record<ReadingFormat, { label: string; detail: string; types: readonly AiQuestionType[] }> = {
  standard: { label: 'Cơ bản', detail: 'Trắc nghiệm, True / False / Not Given, điền từ', types: ['choice', 'tfng', 'gap'] },
  ielts: {
    label: 'IELTS',
    detail: 'IELTS Academic Reading: câu hỏi chia nhóm theo dạng, đoạn văn đánh chữ A, B, C…',
    types: ['heading', 'tfng', 'ynng', 'choice', 'gap', 'short'],
  },
  toeic: {
    label: 'TOEIC',
    detail: 'TOEIC Part 7: văn bản công việc (email, thông báo, quảng cáo…), câu hỏi 4 lựa chọn',
    types: ['choice'],
  },
}

/** chữ đánh dấu đoạn văn kiểu IELTS: A, B, C… */
export const paragraphLetter = (i: number) => String.fromCharCode(65 + i)

/** nguồn bài đọc chia cấp độ có sẵn trên mạng; nguồn không công bố đáp án thì câu hỏi do AI soạn từ bài gốc */
export const LIBRARY_SOURCES = ['essential', 'cambridge-ielts', 'breaking-news', 'onestop', 'linguapress'] as const
export type LibrarySource = (typeof LIBRARY_SOURCES)[number]
/** nguồn có sẵn câu hỏi kèm đáp án gốc (sách, đề thi): không cần AI soạn */
export const SOURCES_WITH_ANSWERS: readonly LibrarySource[] = ['essential', 'cambridge-ielts']

/** bài AI tự viết, người học tự dán, hoặc lấy từ thư viện */
export type ReadingSource = 'ai' | 'custom' | LibrarySource

export const READING_SOURCE_INFO: Record<ReadingSource, { label: string; detail: string; home: string }> = {
  ai: { label: 'AI viết', detail: '', home: '' },
  custom: { label: 'Bài của bạn', detail: '', home: '' },
  essential: {
    label: 'Reading for the Real World',
    detail: 'Bộ sách 1–3 trên essentialenglish.review (72 bài), dùng câu hỏi gốc kèm đáp án của sách',
    home: 'https://www.essentialenglish.review/category/reading/',
  },
  'cambridge-ielts': {
    label: 'Cambridge IELTS 14–18',
    detail: 'Đề thật IELTS Academic Reading (20 đề, 60 bài) trên essentialenglish.review, câu hỏi và đáp án gốc',
    home: 'https://www.essentialenglish.review/category/ielts/',
  },
  'breaking-news': {
    label: 'Breaking News English',
    detail: 'Tin thời sự mới mỗi tuần, cùng một tin viết lại ở 7 mức (Level 0 ≈ A2 … Level 6 ≈ C1)',
    home: 'https://breakingnewsenglish.com',
  },
  onestop: {
    label: 'OneStopEnglish',
    detail: '189 bài báo, mỗi bài 3 mức Elementary / Intermediate / Advanced (CC BY-SA 4.0, Vajjala & Lučić 2018)',
    home: 'https://github.com/nishkalavallabhi/OneStopEnglishCorpus',
  },
  linguapress: {
    label: 'Linguapress',
    detail: 'Bài về văn hoá, lịch sử, xã hội Anh – Mỹ, có ghi cấp CEFR (A2 – C1)',
    home: 'https://linguapress.com',
  },
}

/** giới hạn độ dài bài tự dán (ký tự) */
export const CUSTOM_TEXT_MIN = 200
export const CUSTOM_TEXT_MAX = 20_000

/**
 * văn bản dán vào → các đoạn: tách theo dòng trống; dán từ trang web / PDF không có dòng trống thì tách theo từng dòng.
 * Gộp khoảng trắng, bỏ đoạn rỗng.
 */
export function splitPastedText(text: string): string[] {
  const clean = text.replace(/\r\n?/g, '\n').replace(/[ \t\u00A0]+/g, ' ')
  const blocks = /\n\s*\n/.test(clean) ? clean.split(/\n\s*\n/) : clean.split('\n')
  return blocks.map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

export const TFNG_OPTIONS = ['True', 'False', 'Not Given']
export const YNNG_OPTIONS = ['Yes', 'No', 'Not Given']

export const READING_COUNTS = [5, 8, 10, 12, 15] as const

export interface ReadingTopic {
  /** nhóm chủ đề, tiếng Việt */
  group: string
  /** chủ đề đưa cho AI, tiếng Anh */
  topic: string
}

const group = (name: string, ...topics: string[]): ReadingTopic[] => topics.map((topic) => ({ group: name, topic }))

export const READING_TOPICS: ReadingTopic[] = [
  ...group('Công nghệ', 'Artificial intelligence in daily life', 'Social media and young people', 'Remote work', 'Smartphones and sleep'),
  ...group('Môi trường', 'Plastic pollution in the ocean', 'Climate change and cities', 'Renewable energy', 'Endangered animals'),
  ...group('Sức khoẻ', 'Healthy eating habits', 'The benefits of exercise', 'Stress and mental health', 'Why we need sleep'),
  ...group('Du lịch & văn hoá', 'Street food around the world', 'Festivals in different countries', 'Sustainable tourism', 'Learning a new language abroad'),
  ...group('Giáo dục & công việc', 'Online learning', 'The future of jobs', 'Studying abroad', 'Starting a small business'),
  ...group('Khoa học & lịch sử', 'Space exploration', 'Famous inventions', 'How the brain learns', 'Ancient civilizations'),
]

/** câu tự gõ (điền từ, trả lời ngắn) */
export const isTypedQuestion = (type: string) => type === 'gap' || type === 'short'

/** câu chọn nhiều đáp án lưu các phương án đã chọn nối bằng "|" */
export const MULTI_SEPARATOR = '|'
export const splitMulti = (answer: string) => answer.split(MULTI_SEPARATOR).filter(Boolean)

/**
 * câu trả lời khớp đáp án: chọn thì so nguyên phương án, tự gõ thì chấp nhận dạng rút gọn, dấu câu, mọi đáp án đúng,
 * chọn nhiều thì phải chọn đúng và đủ các đáp án
 */
export function isReadingCorrect(q: ReadingQuestion, answer: string) {
  if (q.type === 'multi') {
    const picked = new Set(splitMulti(answer))
    return picked.size === q.answers.length && q.answers.every((a) => picked.has(a))
  }
  return isTypedQuestion(q.type) ? matchesAnswer(answer, q.answers) : normalizeAnswer(answer) === normalizeAnswer(q.answers[0])
}
