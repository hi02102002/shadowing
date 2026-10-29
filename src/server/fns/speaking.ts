import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { speakingAttempts } from '#/db/schema.ts'
import type { SpeakingFeedback } from '#/db/schema.ts'
import { MAX_SPEAK_SECONDS, SPEAKING_TARGETS } from '#/lib/speaking-topics.ts'
import { SPEAKING_FEEDBACK_SYSTEM, SpeakingFeedbackSchema, speakingFeedbackPrompt } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { hearSpeech } from '../hear-speech.ts'
import { recordSpeechMistakes } from '../mistakes.ts'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024

function requireAttempt(id: number) {
  const row = db.select().from(speakingAttempts).where(eq(speakingAttempts.id, id)).get()
  if (!row) throw new Error('Không tìm thấy bài nói')
  return row
}

export const listSpeakingAttempts = createServerFn({ method: 'GET' }).handler(async () =>
  db
    .select({
      id: speakingAttempts.id,
      topicId: speakingAttempts.topicId,
      title: speakingAttempts.title,
      target: speakingAttempts.target,
      durationSec: speakingAttempts.durationSec,
      feedback: speakingAttempts.feedback,
      createdAt: speakingAttempts.createdAt,
    })
    .from(speakingAttempts)
    .orderBy(desc(speakingAttempts.id))
    .limit(30)
    .all()
    .map(({ feedback, ...a }) => ({ ...a, overall: feedback?.overall ?? null })),
)

export const getSpeakingAttempt = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => requireAttempt(data.id))

/** Nhận bài nói (audio) và chép lời; chấm điểm gọi riêng bằng assessSpeaking để chấm lại được khi AI lỗi */
export const submitSpeaking = createServerFn({ method: 'POST' })
  .validator((form: FormData) => {
    if (!(form instanceof FormData)) throw new Error('Dữ liệu không hợp lệ')
    const audio = form.get('audio')
    if (!(audio instanceof File) || audio.size === 0) throw new Error('Thiếu file ghi âm')
    if (audio.size > MAX_AUDIO_BYTES) throw new Error('File ghi âm quá lớn (tối đa 10MB)')
    return {
      audio,
      topicId: z.string().min(1).max(40).parse(form.get('topicId')),
      title: z.string().trim().min(1).max(300).parse(form.get('title')),
      target: z.enum(SPEAKING_TARGETS).catch('6').parse(form.get('target')),
      bullets: z.array(z.string().max(200)).max(8).parse(JSON.parse(String(form.get('bullets') ?? '[]'))),
      durationSec: z.coerce.number().int().min(0).max(MAX_SPEAK_SECONDS + 5).parse(form.get('durationSec')),
    }
  })
  .handler(async ({ data }) => {
    const transcript = await hearSpeech(data.audio)
    if (!transcript) throw new Error('Không nghe rõ, hãy nói lại')
    const { audio: _, ...rest } = data
    return db.insert(speakingAttempts).values({ ...rest, transcript }).returning({ id: speakingAttempts.id }).get()
  })

export const assessSpeaking = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }): Promise<SpeakingFeedback> => {
    const row = requireAttempt(data.id)
    if (row.feedback) return row.feedback
    const feedback = await structured({
      system: SPEAKING_FEEDBACK_SYSTEM,
      prompt: speakingFeedbackPrompt(row),
      schema: SpeakingFeedbackSchema,
    })
    db.update(speakingAttempts).set({ feedback }).where(eq(speakingAttempts.id, row.id)).run()
    recordSpeechMistakes('speaking', feedback.corrections)
    return feedback
  })

export const deleteSpeakingAttempt = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    db.delete(speakingAttempts).where(eq(speakingAttempts.id, data.id)).run()
    return { ok: true }
  })
