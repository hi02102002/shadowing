import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { dictationAttempts, segments } from '#/db/schema.ts'
import { alignWords } from '#/lib/align.ts'
import type { AlignToken } from '#/lib/align.ts'
import { DICTATION_SYSTEM, DictationAnalysisSchema, dictationPrompt } from '../ai/prompts.ts'
import type { DictationAnalysis } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { recordMistakes } from '../mistakes.ts'

export const submitDictation = createServerFn({ method: 'POST' })
  .validator(z.object({ segmentId: z.number().int(), input: z.string() }))
  .handler(async ({ data }) => {
    const seg = db.select().from(segments).where(eq(segments.id, data.segmentId)).get()
    if (!seg) throw new Error('Không tìm thấy câu')
    const result = alignWords(seg.text, data.input)
    const attempt = db
      .insert(dictationAttempts)
      .values({
        segmentId: seg.id,
        input: data.input,
        score: result.score,
        diffJson: JSON.stringify(result.tokens),
      })
      .returning({ id: dictationAttempts.id })
      .get()
    return { attemptId: attempt.id, ...result }
  })

export const analyzeDictation = createServerFn({ method: 'POST' })
  .validator(z.object({ attemptId: z.number().int() }))
  .handler(async ({ data }): Promise<DictationAnalysis> => {
    const row = db
      .select({ attempt: dictationAttempts, seg: segments })
      .from(dictationAttempts)
      .innerJoin(segments, eq(segments.id, dictationAttempts.segmentId))
      .where(eq(dictationAttempts.id, data.attemptId))
      .get()
    if (!row) throw new Error('Không tìm thấy bài làm')
    if (row.attempt.aiJson) return JSON.parse(row.attempt.aiJson) as DictationAnalysis

    const prev = db
      .select({ text: segments.text })
      .from(segments)
      .where(and(eq(segments.videoId, row.seg.videoId), eq(segments.idx, row.seg.idx - 1)))
      .get()

    const tokens = JSON.parse(row.attempt.diffJson) as AlignToken[]
    const analysis = await structured({
      system: DICTATION_SYSTEM,
      prompt: dictationPrompt(row.seg.text, row.attempt.input, tokens, prev?.text),
      schema: DictationAnalysisSchema,
    })

    db.update(dictationAttempts)
      .set({ aiJson: JSON.stringify(analysis) })
      .where(eq(dictationAttempts.id, data.attemptId))
      .run()
    recordMistakes('dictation', row.seg.id, analysis.mistakes)
    return analysis
  })

export const dictationHistory = createServerFn({ method: 'GET' })
  .validator(z.object({ segmentId: z.number().int() }))
  .handler(async ({ data }) =>
    db
      .select({
        id: dictationAttempts.id,
        input: dictationAttempts.input,
        score: dictationAttempts.score,
        createdAt: dictationAttempts.createdAt,
      })
      .from(dictationAttempts)
      .where(eq(dictationAttempts.segmentId, data.segmentId))
      .orderBy(desc(dictationAttempts.createdAt))
      .limit(10)
      .all(),
  )
