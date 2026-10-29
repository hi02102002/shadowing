import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { grammarAnswers, lookups, mistakes, segments, videos } from '#/db/schema.ts'
import { countItems, expectedAnswer, itemKey } from '#/lib/grammar.ts'
import type { GrammarUnit } from '#/lib/grammar.ts'
import { checkAnswer, decodeChoice, decodeRightWrong, normalizeAnswer } from '#/lib/grammar-check.ts'
import { GRAMMAR_PATTERNS, matchGrammar } from '#/lib/grammar-patterns.ts'
import {
  DRILL_LEVELS,
  DRILL_TYPES,
  GRAMMAR_SYSTEM,
  GrammarDrillSchema,
  GrammarExplainSchema,
  GrammarMistakeSchema,
  grammarAnswerPrompt,
  grammarDrillPrompt,
  grammarSectionPrompt,
} from '../ai/prompts.ts'
import type { GrammarDrill, GrammarExplain, GrammarMistake } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { getUnit, loadBook, plainText } from '../grammar/egiu.ts'
import { recordGrammarMistake } from '../mistakes.ts'

async function requireUnit(id: string): Promise<GrammarUnit> {
  const unit = await getUnit(id)
  if (!unit) throw new Error('Không tìm thấy bài ngữ pháp')
  return unit
}

/** đọc / ghi cache AI trong bảng lookups */
async function cachedAi<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = db.select().from(lookups).where(eq(lookups.key, key)).get()
  if (hit) return JSON.parse(hit.json) as T
  const value = await load()
  db.insert(lookups)
    .values({ key, json: JSON.stringify(value) })
    .onConflictDoUpdate({ target: lookups.key, set: { json: JSON.stringify(value) } })
    .run()
  return value
}

/** câu trả lời dạng chữ để ghi sổ lỗi và đưa cho AI */
function readableAnswer(item: GrammarUnit['exercises'][number]['items'][number], answer: string) {
  if (item.kind === 'choice') return decodeChoice(answer).map((i) => item.options[i] ?? '?').join(' + ')
  if (item.kind === 'rightWrong') {
    const { right, fix } = decodeRightWrong(answer)
    return right == null ? '' : right ? 'Right' : `Wrong → ${fix}`
  }
  return answer
}

export const listGrammarUnits = createServerFn({ method: 'GET' }).handler(async () => {
  const book = await loadBook()
  const done = new Map(
    db
      .select({ unitId: grammarAnswers.unitId, correct: sql<number>`sum(${grammarAnswers.correct})` })
      .from(grammarAnswers)
      .groupBy(grammarAnswers.unitId)
      .all()
      .map((r) => [r.unitId, r.correct]),
  )
  return book.map((u) => ({
    id: u.id,
    title: u.title,
    group: u.group,
    total: countItems(u.exercises),
    correct: done.get(u.id) ?? 0,
  }))
})

export type GrammarUnitSummary = Awaited<ReturnType<typeof listGrammarUnits>>[number]

export const getGrammarUnit = createServerFn({ method: 'GET' })
  .validator(z.object({ unitId: z.string() }))
  .handler(async ({ data }) => {
    const book = await loadBook()
    const at = book.findIndex((u) => u.id === data.unitId)
    if (at < 0) return null
    const answers = Object.fromEntries(
      db
        .select({ key: grammarAnswers.itemKey, answer: grammarAnswers.answer, correct: grammarAnswers.correct })
        .from(grammarAnswers)
        .where(eq(grammarAnswers.unitId, data.unitId))
        .all()
        .map((r) => [r.key, { answer: r.answer, correct: r.correct }]),
    )
    const nav = (u: GrammarUnit | undefined) => (u ? { id: u.id, title: u.title } : null)
    return {
      unit: book[at],
      answers,
      prev: nav(book[at - 1]),
      next: nav(book[at + 1]),
      hasPattern: data.unitId in GRAMMAR_PATTERNS,
    }
  })

export type GrammarUnitPage = NonNullable<Awaited<ReturnType<typeof getGrammarUnit>>>

/** chấm một exercise, lưu câu trả lời mới nhất và ghi câu sai vào sổ lỗi */
export const saveGrammarAnswers = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      unitId: z.string(),
      exerciseKey: z.string(),
      answers: z.array(z.object({ idx: z.number().int().min(0), answer: z.string().max(2000) })),
    }),
  )
  .handler(async ({ data }) => {
    const unit = await requireUnit(data.unitId)
    const ex = unit.exercises.find((e) => e.key === data.exerciseKey)
    if (!ex) throw new Error('Không tìm thấy bài tập')
    const results: Record<number, boolean> = {}
    db.transaction((tx) => {
      for (const { idx, answer } of data.answers) {
        const item = ex.items[idx] as (typeof ex.items)[number] | undefined
        if (!item || (item.kind === 'text' && item.example) || !answer.trim()) continue
        const correct = checkAnswer(item, answer)
        results[idx] = correct
        const key = itemKey(ex.key, idx)
        tx.insert(grammarAnswers)
          .values({ unitId: unit.id, itemKey: key, answer, correct })
          .onConflictDoUpdate({
            target: [grammarAnswers.unitId, grammarAnswers.itemKey],
            set: { answer, correct, updatedAt: sql`(unixepoch())` },
          })
          .run()
      }
    })
    for (const [idx, correct] of Object.entries(results)) {
      if (correct) continue
      const item = ex.items[Number(idx)]
      const answer = data.answers.find((a) => a.idx === Number(idx))!.answer
      recordGrammarMistake({
        word: expectedAnswer(item),
        heard: readableAnswer(item, answer),
        ref: `${unit.id}#${itemKey(ex.key, Number(idx))}`,
        explanation: `Unit ${unit.id}, bài ${ex.key}: ${item.prompt.split('\n').find((l) => l.includes('___')) ?? item.prompt.slice(0, 160)}`,
      })
    }
    return results
  })

export const resetGrammarAnswers = createServerFn({ method: 'POST' })
  .validator(z.object({ unitId: z.string(), exerciseKey: z.string() }))
  .handler(async ({ data }) => {
    db.delete(grammarAnswers)
      .where(sql`${grammarAnswers.unitId} = ${data.unitId} and ${grammarAnswers.itemKey} like ${`${data.exerciseKey}#%`}`)
      .run()
    return { ok: true }
  })

export const explainGrammarSection = createServerFn({ method: 'POST' })
  .validator(z.object({ unitId: z.string(), section: z.number().int().min(0) }))
  .handler(async ({ data }): Promise<GrammarExplain> => {
    const unit = await requireUnit(data.unitId)
    const section = unit.sections.at(data.section)
    if (!section) throw new Error('Không tìm thấy mục này')
    return cachedAi(`grammar:sec:${unit.id}:${data.section}`, () =>
      structured({
        system: GRAMMAR_SYSTEM,
        prompt: grammarSectionPrompt(unit.title, section.label, plainText(section.body).slice(0, 6000)),
        schema: GrammarExplainSchema,
      }),
    )
  })

export const explainGrammarAnswer = createServerFn({ method: 'POST' })
  .validator(
    z.object({ unitId: z.string(), exerciseKey: z.string(), idx: z.number().int().min(0), answer: z.string().max(2000) }),
  )
  .handler(async ({ data }): Promise<GrammarMistake> => {
    const unit = await requireUnit(data.unitId)
    const ex = unit.exercises.find((e) => e.key === data.exerciseKey)
    const item = ex?.items[data.idx]
    if (!ex || !item) throw new Error('Không tìm thấy câu hỏi')
    const key = itemKey(ex.key, data.idx)
    const answer = readableAnswer(item, data.answer)
    const result = await cachedAi(`grammar:ans:${unit.id}:${key}:${normalizeAnswer(answer)}`, () =>
      structured({
        system: GRAMMAR_SYSTEM,
        prompt: grammarAnswerPrompt({
          unitTitle: unit.title,
          exercise: ex.title,
          question: item.prompt,
          expected: expectedAnswer(item),
          answer,
        }),
        schema: GrammarMistakeSchema,
      }),
    )
    db.update(mistakes)
      .set({ explanation: result.explanation, tip: result.tip })
      .where(eq(mistakes.grammarRef, `${unit.id}#${key}`))
      .run()
    return result
  })

const EXAMPLE_SCAN_LIMIT = 5000
const EXAMPLE_LIMIT = 12

/** câu trong các video đã thêm có dùng cấu trúc của unit (regex heuristic, xem grammar-patterns.ts) */
export const grammarExamples = createServerFn({ method: 'GET' })
  .validator(z.object({ unitId: z.string() }))
  .handler(async ({ data }) => {
    if (!(data.unitId in GRAMMAR_PATTERNS)) return []
    const rows = db
      .select({ text: segments.text, idx: segments.idx, youtubeId: videos.youtubeId, videoTitle: videos.title })
      .from(segments)
      .innerJoin(videos, eq(videos.id, segments.videoId))
      .orderBy(desc(videos.createdAt), segments.idx)
      .limit(EXAMPLE_SCAN_LIMIT)
      .all()
    const out: Array<(typeof rows)[number] & { match: [number, number] }> = []
    const seen = new Set<string>()
    for (const row of rows) {
      const match = matchGrammar(data.unitId, row.text)
      if (!match || seen.has(row.text)) continue
      seen.add(row.text)
      out.push({ ...row, match })
      if (out.length >= EXAMPLE_LIMIT) break
    }
    return out
  })

/** mỗi lượt gọi AI tối đa chừng này câu; bộ lớn hơn chia nhiều lượt gọi song song */
const DRILL_BATCH = 20
/** mỗi lượt một nhóm chủ đề khác nhau để các lượt không đặt trùng câu */
const DRILL_THEMES = [
  'gia đình, nhà cửa, bạn bè',
  'công việc, học tập, trường lớp',
  'du lịch, mua sắm, ăn uống',
  'sức khoẻ, thể thao, thời tiết',
  'công nghệ, giải trí, tin tức',
]
const drillKey = (unitId: string, level: string) => `grammar:drill:${unitId}:${level}`

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean)

/**
 * bỏ câu AI tạo sai dạng: điền/trắc nghiệm phải có đúng một ___, trắc nghiệm phải có đáp án trong phương án,
 * sửa lỗi phải chỉ ra được phần sai trong câu, sắp xếp phải là câu 3–16 từ
 */
export function cleanDrill(drill: GrammarDrill): GrammarDrill['questions'] {
  return drill.questions.flatMap((q) => {
    const blanks = q.prompt.split('___').length - 1
    const answers = q.answers.map((a) => a.trim()).filter(Boolean)
    if (!answers.length || !q.prompt.trim()) return []
    const base = { ...q, options: [], wrong: '', answers }
    switch (q.type) {
      case 'fill':
        return blanks === 1 ? [base] : []
      case 'choice': {
        const options = [...new Set(q.options.map((o) => o.trim()).filter(Boolean))]
        const right = options.find((o) => normalizeAnswer(o) === normalizeAnswer(answers[0]))
        return blanks === 1 && right && options.length >= 2 ? [{ ...base, options, answers: [right] }] : []
      }
      case 'fix': {
        const wrong = q.wrong.trim()
        if (blanks || !wrong || !q.prompt.includes(wrong)) return []
        // chấp nhận cả gõ lại nguyên câu đã sửa
        return [{ ...base, wrong, answers: [...answers, ...answers.map((a) => q.prompt.replace(wrong, a))] }]
      }
      case 'order': {
        const n = words(answers[0]).length
        return n >= 3 && n <= 16 ? [base] : []
      }
      case 'rewrite':
        return blanks ? [] : [base]
    }
  })
}

/**
 * Bài tập AI tạo theo độ khó cho một unit: `generate` mới gọi AI (tạo bộ mới, thay bộ cũ),
 * không thì chỉ trả bộ đã tạo gần nhất (null nếu chưa có).
 */
export const grammarDrill = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      unitId: z.string(),
      level: z.enum(DRILL_LEVELS),
      types: z.array(z.enum(DRILL_TYPES)).min(1).default([...DRILL_TYPES]),
      count: z.number().int().min(1).max(50).default(10),
      generate: z.boolean().default(false),
    }),
  )
  .handler(async ({ data }) => {
    const key = drillKey(data.unitId, data.level)
    if (!data.generate) {
      const hit = db.select().from(lookups).where(eq(lookups.key, key)).get()
      return hit ? (JSON.parse(hit.json) as { questions: GrammarDrill['questions']; createdAt: number }) : null
    }
    const unit = await requireUnit(data.unitId)
    const theory = unit.sections
      .map((s) => `${s.label}. ${plainText(s.body)}`)
      .join('\n\n')
      .slice(0, 8000)
    const batches = Math.ceil(data.count / DRILL_BATCH)
    const parts = await Promise.all(
      Array.from({ length: batches }, (_, b) =>
        structured({
          system: GRAMMAR_SYSTEM,
          prompt: grammarDrillPrompt({
            unitTitle: unit.title,
            theory,
            level: data.level,
            // chia đều: 50 câu → 17 + 17 + 16
            count: Math.floor(data.count / batches) + (b < data.count % batches ? 1 : 0),
            types: data.types,
            themes: batches > 1 ? DRILL_THEMES[b % DRILL_THEMES.length] : undefined,
          }),
          schema: GrammarDrillSchema,
        }),
      ),
    )
    const questions = cleanDrill({ questions: parts.flatMap((p) => p.questions) })
    if (!questions.length) throw new Error('AI tạo bài tập không đúng dạng, thử tạo lại')
    const value = { questions, createdAt: Date.now() }
    const json = JSON.stringify(value)
    db.insert(lookups).values({ key, json }).onConflictDoUpdate({ target: lookups.key, set: { json } }).run()
    return value
  })

export type GrammarDrillSet = NonNullable<Awaited<ReturnType<typeof grammarDrill>>>

/** ghi câu sai của bài tập AI vào sổ lỗi (đáp án đúng, câu trả lời, câu hỏi) */
export const recordDrillMistakes = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      unitId: z.string(),
      wrong: z
        .array(z.object({ prompt: z.string().max(600), expected: z.string().max(200), answer: z.string().max(200) }))
        .max(50),
    }),
  )
  .handler(async ({ data }) => {
    for (const w of data.wrong)
      recordGrammarMistake({
        word: w.expected,
        heard: w.answer,
        ref: `${data.unitId}#ai`,
        explanation: `Unit ${data.unitId}, bài tập AI: ${w.prompt}`,
      })
    return { ok: true }
  })
