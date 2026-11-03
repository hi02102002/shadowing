import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { readingPassages } from '#/db/schema.ts'
import type { ReadingQuestion } from '#/db/schema.ts'
import { normalizeAnswer } from '#/lib/grammar-check.ts'
import { HIGHLIGHT_COLORS } from '#/lib/highlights.ts'
import {
  LIBRARY_SOURCES,
  READING_FORMATS,
  READING_FORMAT_INFO,
  READING_LEVELS,
  AI_QUESTION_TYPES,
  READING_SOURCE_INFO,
  TFNG_OPTIONS,
  CUSTOM_TEXT_MAX,
  CUSTOM_TEXT_MIN,
  YNNG_OPTIONS,
  isReadingCorrect,
  splitPastedText,
} from '#/lib/reading-topics.ts'
import type { AiQuestionType, ReadingFormat, ReadingLevel } from '#/lib/reading-topics.ts'
import { READING_SYSTEM, ReadingPassageSchema, ReadingQuestionsSchema, readingPrompt, readingQuestionsPrompt } from '../ai/prompts.ts'
import type { ReadingPassage } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { recordReadingMistake } from '../mistakes.ts'
import { fetchLibraryArticle, libraryCatalog } from '../reading/sources.ts'
import { collectWords, findPhrases, savedFronts } from '../vocab-words.ts'
import type { PhrasesResult } from '../vocab-words.ts'

/** so khớp trích dẫn với bài: bỏ hoa/thường, nháy cong, khoảng trắng thừa */
const flat = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

/** chọn đáp án trong danh sách cố định (True/False/Not Given…), trả về đúng cách viết trong danh sách */
const pickFrom = (options: string[], answer: string) => options.find((o) => normalizeAnswer(o) === normalizeAnswer(answer))

/**
 * bỏ câu hỏi AI tạo sai dạng: trắc nghiệm phải có đáp án trong phương án, TFNG/YNNG phải là một trong ba đáp án,
 * nối tiêu đề phải trỏ đúng một đoạn có trong bài, điền từ phải có đúng một ___, trả lời ngắn không có ___;
 * trích dẫn không có trong bài thì bỏ trích dẫn (vẫn giữ câu hỏi)
 */
export function cleanReading(passage: ReadingPassage): ReadingQuestion[] {
  const body = flat(passage.paragraphs.join(' '))
  return passage.questions.flatMap((q) => {
    const answers = q.answers.map((a) => a.trim()).filter(Boolean)
    if (!answers.length || !q.prompt.trim()) return []
    const evidence = q.evidence.trim().replace(/^["“]|["”]$/g, '')
    const base = { ...q, prompt: q.prompt.trim(), options: [], answers, evidence: evidence && body.includes(flat(evidence)) ? evidence : '' }
    const blanks = base.prompt.split('___').length - 1
    switch (q.type) {
      case 'choice': {
        const options = [...new Set(q.options.map((o) => o.trim()).filter(Boolean))]
        const right = options.find((o) => normalizeAnswer(o) === normalizeAnswer(answers[0]))
        return right && options.length >= 2 ? [{ ...base, options, answers: [right] }] : []
      }
      case 'tfng':
      case 'ynng': {
        const options = q.type === 'tfng' ? TFNG_OPTIONS : YNNG_OPTIONS
        const right = pickFrom(options, answers[0])
        return right ? [{ ...base, options, answers: [right] }] : []
      }
      case 'heading': {
        const letter = /^paragraph\s+([A-Z])$/i.exec(base.prompt)?.[1].toUpperCase()
        const paragraph = letter ? passage.paragraphs[letter.charCodeAt(0) - 65] : undefined
        const options = [...new Set(q.options.map((o) => o.trim()).filter(Boolean))]
        const right = pickFrom(options, answers[0])
        if (!letter || !paragraph || !right || options.length < 3) return []
        // căn cứ mặc định: câu đầu của đoạn
        const topic = /^.*?[.!?](\s|$)/.exec(paragraph)?.[0].trim() ?? paragraph
        return [{ ...base, prompt: `Paragraph ${letter}`, options, answers: [right], evidence: base.evidence || topic }]
      }
      case 'gap':
        return blanks === 1 ? [base] : []
      case 'short':
        return blanks ? [] : [base]
    }
  })
}

/** dạng câu được chọn thuộc dạng đề; không chọn (hoặc không còn dạng nào hợp) thì dùng mọi dạng của đề */
function formatTypes(format: ReadingFormat, types?: AiQuestionType[]) {
  const allowed = READING_FORMAT_INFO[format].types
  const picked = types?.filter((t) => allowed.includes(t)) ?? []
  return picked.length ? picked : allowed
}

function requirePassage(id: number) {
  const row = db.select().from(readingPassages).where(eq(readingPassages.id, id)).get()
  if (!row) throw new Error('Không tìm thấy bài đọc')
  return row
}

export const listReadings = createServerFn({ method: 'GET' }).handler(async () =>
  db
    .select({
      id: readingPassages.id,
      source: readingPassages.source,
      topic: readingPassages.topic,
      level: readingPassages.level,
      title: readingPassages.title,
      questions: readingPassages.questions,
      score: readingPassages.score,
      createdAt: readingPassages.createdAt,
    })
    .from(readingPassages)
    .orderBy(desc(readingPassages.id))
    .limit(30)
    .all()
    .map(({ questions, ...r }) => ({ ...r, total: questions.length })),
)

export const getReading = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => requirePassage(data.id))

export type ReadingDetail = Awaited<ReturnType<typeof getReading>>

/** AI viết bài đọc mới theo chủ đề và trình độ kèm câu hỏi, lưu lại để làm và xem lại */
export const generateReading = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      topic: z.string().trim().min(1).max(200),
      level: z.enum(READING_LEVELS),
      format: z.enum(READING_FORMATS).default('standard'),
      types: z.array(z.enum(AI_QUESTION_TYPES)).optional(),
      count: z.number().int().min(3).max(15).default(8),
    }),
  )
  .handler(async ({ data }) => {
    const types = formatTypes(data.format, data.types)
    const passage = await structured({ system: READING_SYSTEM, prompt: readingPrompt({ ...data, types }), schema: ReadingPassageSchema })
    const paragraphs = passage.paragraphs.map((p) => p.trim()).filter(Boolean)
    const questions = cleanReading({ ...passage, paragraphs })
    if (!paragraphs.length || questions.length < 3) throw new Error('AI tạo bài đọc không đúng dạng, thử tạo lại')
    const row = db
      .insert(readingPassages)
      .values({
        topic: data.topic,
        level: data.level,
        format: data.format,
        title: passage.title.trim() || data.topic,
        paragraphs,
        glossary: passage.glossary.filter((g) => g.en.trim() && g.vi.trim()),
        questions,
      })
      .returning({ id: readingPassages.id })
      .get()
    return { id: row.id }
  })

/** tách đoạn thành câu (để tô và tra từ theo câu) */
export function splitSentences(paragraph: string) {
  return (paragraph.match(/[^.!?]+(?:[.!?]+["”’)]*|$)/g) ?? []).map((s) => s.trim()).filter(Boolean)
}

/** câu của bài đọc theo thứ tự (tiêu đề là câu 0), dùng chung cho từ đơn và cụm từ */
const passageSentences = (row: { title: string; paragraphs: string[] }) => [row.title, ...row.paragraphs.flatMap(splitSentences)]

/** từ đơn trong bài đọc kèm cấp CEFR (CEFR-J + Octanove), giống tab Từ vựng của video; segIdx là chỉ số trong `sentences` */
export const readingVocab = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const row = requirePassage(data.id)
    const sentences = passageSentences(row)
    return { sentences, words: collectWords(sentences.map((text, idx) => ({ idx, text })), savedFronts()) }
  })

/**
 * Cụm từ (phrasal verb, thành ngữ, collocation) và từ loại theo ngữ cảnh trong bài đọc, do AI tìm như tab Từ vựng của video.
 * Chỉ gọi AI khi `generate`, còn lại trả kết quả đã cache.
 */
export const readingPhrases = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int(), generate: z.boolean().default(false) }))
  .handler(async ({ data }): Promise<PhrasesResult> => {
    const sentences = passageSentences(requirePassage(data.id))
    return findPhrases(`reading-phrases|${data.id}`, sentences.map((text, idx) => ({ idx, text })), data.generate)
  })

/** mục lục một nguồn bài đọc, đánh dấu bài đã mở (id bài đọc trong app) */
export const readingLibrary = createServerFn({ method: 'GET' })
  .validator(z.object({ source: z.enum(LIBRARY_SOURCES) }))
  .handler(async ({ data }) => {
    const items = await libraryCatalog(data.source)
    const opened = new Map(
      db
        .select({ id: readingPassages.id, url: readingPassages.sourceUrl, score: readingPassages.score })
        .from(readingPassages)
        .where(eq(readingPassages.source, data.source))
        .all()
        .map((r) => [r.url, r]),
    )
    return items.map((i) => ({ ...i, readingId: opened.get(i.url)?.id ?? null, score: opened.get(i.url)?.score ?? null }))
  })

export type ReadingLibraryItem = Awaited<ReturnType<typeof readingLibrary>>[number]

/**
 * mở một bài trong thư viện: tải bài gốc và lưu lại; bài đã mở thì trả id cũ.
 * Nguồn có câu hỏi gốc kèm đáp án thì dùng luôn, không thì câu hỏi soạn sau bằng generateReadingQuestions.
 */
export const importReading = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      source: z.enum(LIBRARY_SOURCES),
      url: z.url(),
      level: z.enum(READING_LEVELS),
      levelLabel: z.string().max(60),
      format: z.enum(READING_FORMATS).default('standard'),
    }),
  )
  .handler(async ({ data }) => {
    const hit = db
      .select({ id: readingPassages.id })
      .from(readingPassages)
      .where(eq(readingPassages.sourceUrl, data.url))
      .get()
    if (hit) return { id: hit.id }
    const article = await fetchLibraryArticle(data.source, data.url)
    const row = db
      .insert(readingPassages)
      .values({
        source: data.source,
        sourceUrl: data.url,
        topic: `${READING_SOURCE_INFO[data.source].label} · ${data.levelLabel}`,
        level: data.level,
        format: sourceFormat(data.source, data.format),
        title: article.title,
        paragraphs: article.paragraphs,
        glossary: [],
        questions: article.questions && article.questions.length >= 3 ? article.questions : [],
      })
      .returning({ id: readingPassages.id })
      .get()
    return { id: row.id }
  })

/** bài người học tự dán: lưu lại, câu hỏi soạn sau bằng generateReadingQuestions như bài thư viện */
export const createCustomReading = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      title: z.string().trim().max(200).default(''),
      text: z.string().trim().min(CUSTOM_TEXT_MIN, 'Bài quá ngắn để ra câu hỏi').max(CUSTOM_TEXT_MAX, 'Bài quá dài'),
      level: z.enum(READING_LEVELS),
      format: z.enum(READING_FORMATS).default('standard'),
    }),
  )
  .handler(async ({ data }) => {
    const paragraphs = splitPastedText(data.text)
    // không đặt tên thì lấy vài từ đầu bài
    const words = paragraphs[0].split(' ')
    const title = data.title || `${words.slice(0, 8).join(' ')}${words.length > 8 ? '…' : ''}`
    const row = db
      .insert(readingPassages)
      .values({
        source: 'custom',
        topic: `${READING_SOURCE_INFO.custom.label} · ${data.level}`,
        level: data.level,
        format: data.format,
        title,
        paragraphs,
        glossary: [],
        questions: [],
      })
      .returning({ id: readingPassages.id })
      .get()
    return { id: row.id }
  })

/** đề IELTS gốc luôn là dạng IELTS; nguồn khác theo lựa chọn của người học */
const sourceFormat = (source: string, format: ReadingFormat): ReadingFormat => (source === 'cambridge-ielts' ? 'ielts' : format)

/** bỏ bộ câu AI soạn, quay lại câu hỏi gốc kèm đáp án của sách / đề (tải lại từ nguồn) */
export const restoreSourceQuestions = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const row = requirePassage(data.id)
    const source = LIBRARY_SOURCES.find((s) => s === row.source)
    if (!source || !row.sourceUrl) throw new Error('Bài này không có câu hỏi gốc')
    const article = await fetchLibraryArticle(source, row.sourceUrl)
    if (!article.questions || article.questions.length < 3) throw new Error('Nguồn không có câu hỏi gốc cho bài này')
    db.update(readingPassages)
      .set({ questions: article.questions, format: sourceFormat(source, 'standard'), answers: null, score: null, answeredAt: null })
      .where(eq(readingPassages.id, data.id))
      .run()
    return { ok: true }
  })

/** AI soạn (lại) câu hỏi cho bài có sẵn; xoá kết quả lần làm trước vì câu hỏi đã khác */
export const generateReadingQuestions = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.number().int(),
      /** bỏ trống: giữ dạng đề của bài */
      format: z.enum(READING_FORMATS).optional(),
      types: z.array(z.enum(AI_QUESTION_TYPES)).optional(),
      count: z.number().int().min(3).max(15).default(8),
    }),
  )
  .handler(async ({ data }) => {
    const row = requirePassage(data.id)
    const format = data.format ?? (row.format as ReadingFormat)
    const out = await structured({
      system: READING_SYSTEM,
      prompt: readingQuestionsPrompt({
        title: row.title,
        // bài rất dài thì chỉ đưa phần đầu, đủ để ra câu hỏi
        paragraphs: trimParagraphs(row.paragraphs, 12000),
        level: row.level as ReadingLevel,
        count: data.count,
        types: formatTypes(format, data.types),
        format,
      }),
      schema: ReadingQuestionsSchema,
    })
    const questions = cleanReading({ title: row.title, paragraphs: row.paragraphs, ...out })
    if (questions.length < 3) throw new Error('AI soạn câu hỏi không đúng dạng, thử lại')
    const glossary = out.glossary.filter((g) => g.en.trim() && g.vi.trim())
    db.update(readingPassages)
      .set({ questions, glossary, format, answers: null, score: null, answeredAt: null })
      .where(eq(readingPassages.id, data.id))
      .run()
    return { ok: true }
  })

function trimParagraphs(paragraphs: string[], maxChars: number) {
  let used = 0
  return paragraphs.filter((p) => (used += p.length) <= maxChars || used === p.length)
}

/** chấm bài, lưu lần nộp gần nhất, ghi câu sai vào sổ lỗi */
export const submitReading = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int(), answers: z.array(z.string().max(200)).max(15) }))
  .handler(async ({ data }) => {
    const row = requirePassage(data.id)
    const answers = row.questions.map((_, i) => data.answers[i]?.trim() ?? '')
    let score = 0
    row.questions.forEach((q, i) => {
      if (isReadingCorrect(q, answers[i])) return void score++
      recordReadingMistake({
        // câu chọn nhiều của đề gốc không có câu hỏi riêng: lấy dòng cuối của hướng dẫn
        question: q.prompt || (q.instruction?.split('\n').at(-1) ?? ''),
        answer: answers[i],
        explanation: `Bài đọc "${row.title}". Đáp án: ${q.type === 'multi' ? q.answers.join(', ') : q.answers[0]}. ${q.explanation}${q.evidence ? ` Căn cứ: "${q.evidence}"` : ''}`,
      })
    })
    db.update(readingPassages).set({ answers, score, answeredAt: new Date() }).where(eq(readingPassages.id, data.id)).run()
    return { score }
  })

/** lưu các chỗ bôi màu trong bài (gửi cả danh sách mỗi lần đổi) */
export const saveReadingHighlights = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.number().int(),
      highlights: z
        .array(z.object({ p: z.number().int().min(0), start: z.number().int().min(0), end: z.number().int().min(1), color: z.enum(HIGHLIGHT_COLORS) }))
        .max(500),
    }),
  )
  .handler(async ({ data }) => {
    db.update(readingPassages).set({ highlights: data.highlights }).where(eq(readingPassages.id, data.id)).run()
    return { ok: true }
  })

export const deleteReading = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    db.delete(readingPassages).where(eq(readingPassages.id, data.id)).run()
    return { ok: true }
  })
