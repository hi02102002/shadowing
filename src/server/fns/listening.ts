import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { db } from '#/db/index.ts'
import { listeningPassages } from '#/db/schema.ts'
import { isReadingCorrect } from '#/lib/reading-topics.ts'
import {
  LISTENING_FORMATS,
  LISTENING_LEVELS,
  LISTENING_SOURCE_INFO,
  LISTENING_SOURCES,
} from '#/lib/listening.ts'
import type { ListeningFormat, ListeningSection } from '#/lib/listening.ts'
import {
  LISTENING_SYSTEM,
  ReadingQuestionsSchema,
  listeningQuestionsPrompt,
} from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { recordListeningMistake } from '../mistakes.ts'
import { cleanReading } from '../reading/clean.ts'
import {
  fetchListeningArticle,
  listeningCatalog,
} from '../listening/sources.ts'
import { collectWords, findPhrases, savedFronts } from '../vocab-words.ts'
import type { PhrasesResult } from '../vocab-words.ts'
import { generateCaptionWords } from '../captions.ts'
import { probeMedia } from '../media.ts'
import { segmentWords } from '../transcript/segment.ts'

function requireListening(id: number) {
  const row = db
    .select()
    .from(listeningPassages)
    .where(eq(listeningPassages.id, id))
    .get()
  if (!row) throw new Error('Không tìm thấy bài nghe')
  return row
}

const flatQuestions = (sections: ListeningSection[]) =>
  sections.flatMap((section) => section.questions)
const transcriptLines = (sections: ListeningSection[]) =>
  sections
    .flatMap((section) => [section.title, ...(section.transcript ?? [])])
    .map((line) => line.replace(/\[\[|]]/g, '').trim())
    .filter(Boolean)

export const listListenings = createServerFn({ method: 'GET' }).handler(
  async () =>
    db
      .select()
      .from(listeningPassages)
      .orderBy(desc(listeningPassages.id))
      .limit(30)
      .all()
      .map((row) => ({
        id: row.id,
        source: row.source,
        title: row.title,
        level: row.level,
        topic: row.topic,
        score: row.score,
        total: flatQuestions(row.sections).length,
        answeredAt: row.answeredAt,
        createdAt: row.createdAt,
      })),
)

export const getListening = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => requireListening(data.id))

export type ListeningDetail = Awaited<ReturnType<typeof getListening>>

export const listeningLibrary = createServerFn({ method: 'GET' })
  .validator(z.object({ source: z.enum(LISTENING_SOURCES) }))
  .handler(async ({ data }) => {
    const items = await listeningCatalog(data.source)
    const opened = new Map(
      db
        .select({
          id: listeningPassages.id,
          url: listeningPassages.sourceUrl,
          score: listeningPassages.score,
        })
        .from(listeningPassages)
        .where(eq(listeningPassages.source, data.source))
        .all()
        .map((row) => [row.url, row]),
    )
    return items.map((item) => ({
      ...item,
      listeningId: opened.get(item.url)?.id ?? null,
      score: opened.get(item.url)?.score ?? null,
    }))
  })

export type ListeningLibraryRow = Awaited<
  ReturnType<typeof listeningLibrary>
>[number]

export const importListening = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      source: z.enum(LISTENING_SOURCES),
      url: z.url(),
      level: z.enum(LISTENING_LEVELS),
    }),
  )
  .handler(async ({ data }) => {
    const hit = db
      .select({ id: listeningPassages.id })
      .from(listeningPassages)
      .where(eq(listeningPassages.sourceUrl, data.url))
      .get()
    if (hit) return hit
    const article = await fetchListeningArticle(data.source, data.url)
    const row = db
      .insert(listeningPassages)
      .values({
        source: data.source,
        sourceUrl: data.url,
        title: article.title,
        level: data.level,
        topic: `${LISTENING_SOURCE_INFO[data.source].label} · ${data.level}`,
        format: data.source === 'cambridge-listening' ? 'ielts' : 'standard',
        sections: article.sections,
        answers: null,
      })
      .returning({ id: listeningPassages.id })
      .get()
    return row
  })

export const generateListeningQuestions = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.number().int().positive(),
      format: z.enum(LISTENING_FORMATS).optional(),
      count: z.number().int().min(3).max(20).default(8),
    }),
  )
  .handler(async ({ data }) => {
    const row = requireListening(data.id)
    const format = data.format ?? (row.format as ListeningFormat)
    const eligible = row.sections.filter(
      (section) => section.transcript?.length,
    )
    if (!eligible.length)
      throw new Error('Bài này chưa có lời thoại để AI soạn câu hỏi')
    const perSection = Math.max(3, Math.ceil(data.count / eligible.length))
    const sections: ListeningSection[] = []
    for (const section of row.sections) {
      if (!section.transcript?.length) {
        sections.push(section)
        continue
      }
      const transcript = section.transcript.map((line) =>
        line.replace(/\[\[|]]/g, ''),
      )
      const output = await structured({
        feature: 'listening',
        system: LISTENING_SYSTEM,
        prompt: listeningQuestionsPrompt({
          title: `${row.title} · ${section.title}`,
          transcript,
          level: row.level as (typeof LISTENING_LEVELS)[number],
          count: perSection,
          format,
        }),
        schema: ReadingQuestionsSchema,
      })
      const questions = cleanReading({
        title: section.title,
        paragraphs: transcript,
        ...output,
      })
      if (questions.length < 2)
        throw new Error(
          `AI soạn câu hỏi không đúng dạng cho ${section.title}, thử lại`,
        )
      sections.push({ ...section, questions })
    }
    db.update(listeningPassages)
      .set({ sections, format, answers: null, score: null, answeredAt: null })
      .where(eq(listeningPassages.id, data.id))
      .run()
    return { ok: true }
  })

export const restoreListeningSourceQuestions = createServerFn({
  method: 'POST',
})
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const row = requireListening(data.id)
    const source = LISTENING_SOURCES.find(
      (candidate) => candidate === row.source,
    )
    if (!source || !LISTENING_SOURCE_INFO[source].originalQuestions)
      throw new Error('Nguồn này không có câu hỏi gốc')
    const article = await fetchListeningArticle(source, row.sourceUrl)
    if (!flatQuestions(article.sections).length)
      throw new Error('Không đọc được câu hỏi gốc của bài')
    db.update(listeningPassages)
      .set({
        sections: article.sections,
        format: source === 'cambridge-listening' ? 'ielts' : 'standard',
        answers: null,
        score: null,
        answeredAt: null,
      })
      .where(eq(listeningPassages.id, data.id))
      .run()
    return { ok: true }
  })

/** Tạo lời thoại cho track Tactics bằng đúng pipeline Whisper đang dùng khi tạo caption video. */
export const generateListeningTranscript = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const row = requireListening(data.id)
    if (row.source !== 'tactics')
      throw new Error(
        'Chỉ track Tactics chưa có lời thoại cần tạo bằng Whisper',
      )
    const workDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'shadowing-listening-'),
    )
    try {
      const sections: ListeningSection[] = []
      for (const [index, section] of row.sections.entries()) {
        if (section.transcript?.length || section.media?.kind !== 'audio') {
          sections.push(section)
          continue
        }
        const res = await fetch(section.media.url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok)
          throw new Error(
            `Không tải được audio track ${index + 1} (HTTP ${res.status})`,
          )
        const file = path.join(workDir, `track-${index + 1}.mp3`)
        await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
        const { durationSec } = await probeMedia(file)
        const words = await generateCaptionWords(file, {
          durationSec,
          workDir: path.join(workDir, `whisper-${index + 1}`),
        })
        const transcript = segmentWords(words, { pauseMs: 1500 }).map(
          (sentence) => sentence.text,
        )
        if (!transcript.length)
          throw new Error(
            `Whisper không nhận ra lời nói trong track ${index + 1}`,
          )
        sections.push({ ...section, transcript })
      }
      db.update(listeningPassages)
        .set({ sections })
        .where(eq(listeningPassages.id, data.id))
        .run()
      return { ok: true }
    } finally {
      await fs.rm(workDir, { recursive: true, force: true })
    }
  })

export const submitListening = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.number().int().positive(),
      answers: z.array(z.string().max(300)).max(60),
    }),
  )
  .handler(async ({ data }) => {
    const row = requireListening(data.id)
    const questions = flatQuestions(row.sections)
    const answers = questions.map(
      (_, index) => data.answers[index]?.trim() ?? '',
    )
    let score = 0
    questions.forEach((question, index) => {
      if (isReadingCorrect(question, answers[index])) return void score++
      recordListeningMistake({
        question:
          question.prompt ||
          question.instruction?.split('\n').at(-1) ||
          'Listening question',
        answer: answers[index],
        explanation: `Bài nghe "${row.title}". Đáp án: ${question.answers.join(', ')}. ${question.explanation}`,
      })
    })
    db.update(listeningPassages)
      .set({ answers, score, answeredAt: new Date() })
      .where(eq(listeningPassages.id, data.id))
      .run()
    return { score }
  })

export const listeningVocab = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sentences = transcriptLines(requireListening(data.id).sections)
    return {
      sentences,
      words: collectWords(
        sentences.map((text, idx) => ({ idx, text })),
        savedFronts(),
      ),
    }
  })

export const listeningPhrases = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.number().int().positive(),
      generate: z.boolean().default(false),
    }),
  )
  .handler(async ({ data }): Promise<PhrasesResult> => {
    const sentences = transcriptLines(requireListening(data.id).sections)
    return findPhrases(
      `listening-phrases|${data.id}`,
      sentences.map((text, idx) => ({ idx, text })),
      data.generate,
    )
  })

export const deleteListening = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    db.delete(listeningPassages).where(eq(listeningPassages.id, data.id)).run()
    return { ok: true }
  })
