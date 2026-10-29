import fs from 'node:fs/promises'
import path from 'node:path'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { speakingAttempts } from '#/db/schema.ts'
import type { SpeakingFeedback } from '#/db/schema.ts'
import { MAX_SPEAK_SECONDS, SPEAKING_TARGETS } from '#/lib/speaking-topics.ts'
import { audioStructured } from '../ai/audio-assess.ts'
import { SpeakingAudioFeedbackSchema, SpeakingFeedbackSchema, speakingFeedbackPrompt, speakingFeedbackSystem } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { toWav16k } from '../audio.ts'
import { getConfig, hasAudioLlm } from '../config.ts'
import { hearSpeech } from '../hear-speech.ts'
import { recordMistakes, recordSpeechMistakes } from '../mistakes.ts'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const RECORDINGS_DIR = path.resolve(process.env.DATA_DIR ?? 'data', 'recordings')

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
  .handler(async ({ data }) => {
    const { audioPath, ...row } = requireAttempt(data.id)
    return { ...row, hasAudio: !!audioPath }
  })

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
    const { audio, ...rest } = data
    const row = db.insert(speakingAttempts).values({ ...rest, transcript }).returning({ id: speakingAttempts.id }).get()
    // giữ bản ghi để nghe lại và để model nghe được audio chấm Pronunciation
    await fs.mkdir(RECORDINGS_DIR, { recursive: true })
    const ext = audio.type.includes('ogg') ? 'ogg' : audio.type.includes('mp4') ? 'm4a' : 'webm'
    const audioPath = path.join(RECORDINGS_DIR, `speaking-${row.id}.${ext}`)
    await fs.writeFile(audioPath, Buffer.from(await audio.arrayBuffer()))
    db.update(speakingAttempts).set({ audioPath }).where(eq(speakingAttempts.id, row.id)).run()
    return row
  })

export const assessSpeaking = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }): Promise<SpeakingFeedback> => {
    const row = requireAttempt(data.id)
    if (row.feedback) return row.feedback
    const cfg = getConfig()
    const raw = row.audioPath ? await fs.readFile(row.audioPath).catch(() => null) : null
    // Pronunciation chỉ chấm được khi model nghe trực tiếp bản ghi (Cài đặt chọn LLM nghe audio)
    const feedback: SpeakingFeedback =
      raw && cfg.pronunciationEngine === 'llm-audio' && hasAudioLlm(cfg)
        ? await audioStructured({
            wav: (await toWav16k(raw)).wav,
            system: speakingFeedbackSystem(cfg.accent, true),
            prompt: speakingFeedbackPrompt(row),
            schema: SpeakingAudioFeedbackSchema,
            name: 'speaking_assessment',
            cfg,
          })
        : await structured({
            system: speakingFeedbackSystem(cfg.accent, false),
            prompt: speakingFeedbackPrompt(row),
            schema: SpeakingFeedbackSchema,
          })
    db.update(speakingAttempts).set({ feedback }).where(eq(speakingAttempts.id, row.id)).run()
    recordSpeechMistakes('speaking', feedback.corrections)
    if (feedback.pronunciation) recordMistakes('speaking', null, feedback.pronunciation.mistakes)
    return feedback
  })

export const deleteSpeakingAttempt = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const row = db.select({ audioPath: speakingAttempts.audioPath }).from(speakingAttempts).where(eq(speakingAttempts.id, data.id)).get()
    if (row?.audioPath) await fs.rm(row.audioPath, { force: true })
    db.delete(speakingAttempts).where(eq(speakingAttempts.id, data.id)).run()
    return { ok: true }
  })
