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
  GRAMMAR_SYSTEM,
  GrammarExplainSchema,
  GrammarMistakeSchema,
  grammarAnswerPrompt,
  grammarSectionPrompt,
} from '../ai/prompts.ts'
import type { GrammarExplain, GrammarMistake } from '../ai/prompts.ts'
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
