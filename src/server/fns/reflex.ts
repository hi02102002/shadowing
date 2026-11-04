import { createServerFn } from '@tanstack/react-start'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { reflexItems, reflexSessions } from '#/db/schema.ts'
import {
  MAX_ANSWER_SECONDS,
  MIN_ANSWER_SECONDS,
  REFLEX_LEVELS,
  REFLEX_MODES,
  REFLEX_SOURCES,
  REFLEX_SOURCE_INFO,
} from '#/lib/reflex.ts'
import type { ReflexMode, ReflexPrompt } from '#/lib/reflex.ts'
import {
  ReflexGradeSchema,
  ReflexSetSchema,
  reflexGradePrompt,
  reflexGradeSystem,
  reflexSetPrompt,
  reflexSetSystem,
} from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { hearSpeech } from '../hear-speech.ts'
import { recordSpeechMistakes } from '../mistakes.ts'
import {
  iteslJTopics,
  pickBank,
  pickChunks,
  pickIteslJ,
  pickTatoeba,
} from '../reflex/sources.ts'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024

function requireSession(id: number) {
  const s = db
    .select()
    .from(reflexSessions)
    .where(eq(reflexSessions.id, id))
    .get()
  if (!s) throw new Error('Không tìm thấy buổi luyện')
  return s
}

const itemsOf = (id: number) =>
  db
    .select()
    .from(reflexItems)
    .where(eq(reflexItems.sessionId, id))
    .orderBy(asc(reflexItems.position))
    .all()

export const listReflexSessions = createServerFn({ method: 'GET' }).handler(
  async () =>
    db
      .select({
        id: reflexSessions.id,
        mode: reflexSessions.mode,
        source: reflexSessions.source,
        level: reflexSessions.level,
        topic: reflexSessions.topic,
        createdAt: reflexSessions.createdAt,
        finishedAt: reflexSessions.finishedAt,
        total: sql<number>`(select count(*) from ${reflexItems} where ${reflexItems.sessionId} = ${reflexSessions.id})`,
        done: sql<number>`(select count(*) from ${reflexItems} where ${reflexItems.sessionId} = ${reflexSessions.id} and (${reflexItems.answeredAt} is not null or ${reflexItems.skipped} = 1))`,
        avgScore: sql<
          number | null
        >`(select round(avg(${reflexItems.score}), 1) from ${reflexItems} where ${reflexItems.sessionId} = ${reflexSessions.id} and ${reflexItems.score} is not null)`,
      })
      .from(reflexSessions)
      .orderBy(desc(reflexSessions.id))
      .limit(20)
      .all(),
)

export const getReflexSession = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => ({
    ...requireSession(data.id),
    items: itemsOf(data.id),
  }))

export type ReflexSessionDetail = Awaited<ReturnType<typeof getReflexSession>>
export type ReflexItemRow = ReflexSessionDetail['items'][number]

/** chủ đề iTESLj cho ô chọn chủ đề */
export const listReflexTopics = createServerFn({ method: 'GET' }).handler(
  async () => iteslJTopics(),
)

async function aiPrompts(
  mode: ReflexMode,
  level: (typeof REFLEX_LEVELS)[number],
  count: number,
  topic?: string,
) {
  const { items } = await structured({
    system: reflexSetSystem(mode),
    prompt: reflexSetPrompt({ count, level, topic }),
    schema: ReflexSetSchema,
  })
  return items
    .filter((i) => i.prompt.trim())
    .slice(0, count)
    .map((i): ReflexPrompt => ({
      prompt: i.prompt.trim(),
      promptLang: mode === 'qa' || mode === 'pattern' ? 'en' : 'vi',
      hint: i.hint?.trim() || null,
      reference: i.reference.trim() || null,
    }))
}

export const startReflexSession = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      mode: z.enum(REFLEX_MODES),
      source: z.enum(REFLEX_SOURCES),
      level: z.enum(REFLEX_LEVELS),
      /** AI: chủ đề tự do; iTESLj: slug chủ đề */
      topic: z.string().trim().max(200).optional(),
      count: z.number().int().min(1).max(30),
      answerSeconds: z
        .number()
        .int()
        .min(MIN_ANSWER_SECONDS)
        .max(MAX_ANSWER_SECONDS),
    }),
  )
  .handler(async ({ data }) => {
    if (!REFLEX_SOURCE_INFO[data.source].modes.includes(data.mode))
      throw new Error('Nguồn này không có dạng bài đã chọn')
    const topic = data.topic || undefined
    let prompts: ReflexPrompt[]
    let topicLabel: string | null = topic ?? null
    if (data.source === 'bank')
      prompts = pickBank(data.mode, data.level, data.count)
    else if (data.source === 'chunks')
      prompts = pickChunks(data.level, data.count)
    else if (data.source === 'tatoeba')
      prompts = await pickTatoeba(data.level, data.count)
    else if (data.source === 'iteslj') {
      prompts = await pickIteslJ(data.level, data.count, topic)
      topicLabel = topic ? (prompts[0]?.hint ?? topic) : null
    } else prompts = await aiPrompts(data.mode, data.level, data.count, topic)
    if (!prompts.length) throw new Error('Không lấy được câu nào, hãy thử lại')

    return db.transaction((tx) => {
      const session = tx
        .insert(reflexSessions)
        .values({
          mode: data.mode,
          source: data.source,
          level: data.level,
          topic: topicLabel,
          answerSeconds: data.answerSeconds,
        })
        .returning()
        .get()
      tx.insert(reflexItems)
        .values(
          prompts.map((p, i) => ({
            sessionId: session.id,
            position: i,
            prompt: p.prompt,
            promptLang: p.promptLang,
            hint: p.hint ?? null,
            reference: p.reference ?? null,
            attribution: p.attribution ?? null,
          })),
        )
        .run()
      return { id: session.id }
    })
  })

function requireItem(id: number) {
  const item = db.select().from(reflexItems).where(eq(reflexItems.id, id)).get()
  if (!item) throw new Error('Không tìm thấy câu này')
  return { item, session: requireSession(item.sessionId) }
}

export const submitReflexAnswer = createServerFn({ method: 'POST' })
  .validator((form: FormData) => {
    if (!(form instanceof FormData)) throw new Error('Dữ liệu không hợp lệ')
    const audio = form.get('audio')
    if (!(audio instanceof File) || audio.size === 0)
      throw new Error('Thiếu bản ghi âm')
    if (audio.size > MAX_AUDIO_BYTES)
      throw new Error('File ghi âm quá lớn (tối đa 10MB)')
    const latency = form.get('latencyMs')
    return {
      itemId: z.coerce.number().int().parse(form.get('itemId')),
      audio,
      latencyMs: latency
        ? z.coerce.number().int().min(0).max(120_000).parse(latency)
        : null,
    }
  })
  .handler(async ({ data }) => {
    const { item, session } = requireItem(data.itemId)
    const said = await hearSpeech(data.audio)
    if (!said.trim()) throw new Error('Không nghe rõ, hãy nói lại')
    const feedback = await structured({
      system: reflexGradeSystem(session.mode as ReflexMode),
      prompt: reflexGradePrompt({
        level: session.level,
        prompt: item.prompt,
        hint: item.hint,
        reference: item.reference,
        said,
        latencyMs: data.latencyMs,
      }),
      schema: ReflexGradeSchema,
    })
    const score =
      Math.round(Math.min(10, Math.max(0, feedback.score)) * 10) / 10
    const row = db
      .update(reflexItems)
      .set({
        transcript: said,
        latencyMs: data.latencyMs,
        score,
        feedback: { ...feedback, score },
        skipped: false,
        answeredAt: new Date(),
      })
      .where(eq(reflexItems.id, item.id))
      .returning()
      .get()
    recordSpeechMistakes('reflex', feedback.corrections)
    return row
  })

export const skipReflexItem = createServerFn({ method: 'POST' })
  .validator(z.object({ itemId: z.number().int() }))
  .handler(async ({ data }) => {
    const { item } = requireItem(data.itemId)
    return db
      .update(reflexItems)
      .set({ skipped: true })
      .where(eq(reflexItems.id, item.id))
      .returning()
      .get()
  })

export const finishReflexSession = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const s = requireSession(data.id)
    if (!s.finishedAt)
      db.update(reflexSessions)
        .set({ finishedAt: new Date() })
        .where(eq(reflexSessions.id, s.id))
        .run()
    return { ok: true }
  })

export const deleteReflexSession = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    db.delete(reflexSessions).where(eq(reflexSessions.id, data.id)).run()
    return { ok: true }
  })
