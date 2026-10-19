import fs from 'node:fs/promises'
import path from 'node:path'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { pronunciationAttempts, segments } from '#/db/schema.ts'
import { alignWords, displayWords } from '#/lib/align.ts'
import type { AlignToken } from '#/lib/align.ts'
import { assessWithAudioLlm } from '../ai/audio-assess.ts'
import {
  PRONUNCIATION_SYSTEM,
  PronunciationFeedbackSchema,
  pronunciationPrompt,
} from '../ai/prompts.ts'
import type { PronunciationFeedback } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { toWav16k } from '../audio.ts'
import { getConfig } from '../config.ts'
import { recordMistakes } from '../mistakes.ts'
import { transcribe } from '../stt.ts'
import type { SttWord } from '../stt.ts'

const RECORDINGS_DIR = path.resolve(
  process.env.DATA_DIR ?? 'data',
  'recordings',
)
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

interface StoredWords {
  stt: SttWord[]
  pauses: Array<{ after: string; ms: number }>
  tokens: AlignToken[]
}

export const assessPronunciation = createServerFn({ method: 'POST' })
  .validator((form: FormData) => {
    if (!(form instanceof FormData)) throw new Error('Dữ liệu không hợp lệ')
    const audio = form.get('audio')
    if (!(audio instanceof File) || audio.size === 0)
      throw new Error('Thiếu file ghi âm')
    if (audio.size > MAX_AUDIO_BYTES)
      throw new Error('File ghi âm quá lớn (tối đa 10MB)')
    return {
      audio,
      segmentId: z.coerce.number().int().parse(form.get('segmentId')),
      mode: z.enum(['shadow', 'repeat']).parse(form.get('mode') ?? 'repeat'),
    }
  })
  .handler(async ({ data }) => {
    const seg = db
      .select()
      .from(segments)
      .where(eq(segments.id, data.segmentId))
      .get()
    if (!seg) throw new Error('Không tìm thấy câu')

    const cfg = getConfig()
    const raw = Buffer.from(await data.audio.arrayBuffer())

    let transcript: string
    let words: SttWord[] = []
    let feedback: PronunciationFeedback | null = null
    let spokenSec = 0

    if (cfg.pronunciationEngine === 'llm-audio') {
      // model nghe trực tiếp: chữ nghe được + nhận xét trong một lần gọi
      const { wav, durationMs } = await toWav16k(raw)
      if (durationMs < 400) throw new Error('Bản ghi quá ngắn, hãy nói lại')
      const { transcript: heard, ...rest } = await assessWithAudioLlm(
        wav,
        seg.text,
        cfg,
      )
      transcript = heard.trim()
      feedback = rest
      spokenSec = durationMs / 1000
    } else {
      const stt = await transcribe(data.audio, { cfg })
      transcript = stt.text.trim()
      words = stt.words
      spokenSec = words.length
        ? words[words.length - 1].end - words[0].start
        : 0
    }

    const result = alignWords(seg.text, transcript)
    const missing = result.tokens.filter((t) => t.op === 'missing').length
    const completeness = result.refCount
      ? Math.round(((result.refCount - missing) / result.refCount) * 100)
      : 0

    // STT có timestamp từng từ → đo chính xác; LLM chỉ có tổng thời lượng bản ghi (gồm cả khoảng lặng đầu/cuối)
    const spokenCount = words.length || displayWords(transcript).length
    const wpm =
      spokenCount >= 2 && spokenSec > 0
        ? Math.round((spokenCount / spokenSec) * 60)
        : null
    const refDur = (seg.endMs - seg.startMs) / 1000
    const refWpm =
      refDur > 0
        ? Math.round((displayWords(seg.text).length / refDur) * 60)
        : null

    const pauses: StoredWords['pauses'] = []
    for (let i = 0; i < words.length - 1; i++) {
      const gap = Math.round((words[i + 1].start - words[i].end) * 1000)
      if (gap > 400) pauses.push({ after: words[i].word.trim(), ms: gap })
    }

    const stored: StoredWords = { stt: words, pauses, tokens: result.tokens }
    const attempt = db
      .insert(pronunciationAttempts)
      .values({
        segmentId: seg.id,
        mode: data.mode,
        transcript,
        accuracy: result.score,
        completeness,
        wpm,
        refWpm,
        wordsJson: JSON.stringify(stored),
        aiJson: feedback ? JSON.stringify(feedback) : null,
      })
      .returning({ id: pronunciationAttempts.id })
      .get()

    await fs.mkdir(RECORDINGS_DIR, { recursive: true })
    const ext = data.audio.type.includes('ogg')
      ? 'ogg'
      : data.audio.type.includes('mp4')
        ? 'm4a'
        : 'webm'
    const audioPath = path.join(RECORDINGS_DIR, `${attempt.id}.${ext}`)
    await fs.writeFile(audioPath, raw)
    db.update(pronunciationAttempts)
      .set({ audioPath })
      .where(eq(pronunciationAttempts.id, attempt.id))
      .run()

    if (feedback) recordMistakes('pronunciation', seg.id, feedback.mistakes)

    return {
      attemptId: attempt.id,
      engine: cfg.pronunciationEngine,
      transcript,
      accuracy: result.score,
      completeness,
      wpm,
      refWpm,
      tokens: result.tokens,
      pauses,
    }
  })

export type PronunciationResult = Awaited<
  ReturnType<typeof assessPronunciation>
>

export const pronunciationFeedback = createServerFn({ method: 'POST' })
  .validator(z.object({ attemptId: z.number().int() }))
  .handler(async ({ data }): Promise<PronunciationFeedback> => {
    const row = db
      .select({ attempt: pronunciationAttempts, seg: segments })
      .from(pronunciationAttempts)
      .innerJoin(segments, eq(segments.id, pronunciationAttempts.segmentId))
      .where(eq(pronunciationAttempts.id, data.attemptId))
      .get()
    if (!row) throw new Error('Không tìm thấy bài làm')
    if (row.attempt.aiJson)
      return JSON.parse(row.attempt.aiJson) as PronunciationFeedback

    const stored = JSON.parse(row.attempt.wordsJson) as StoredWords
    const feedback = await structured({
      system: PRONUNCIATION_SYSTEM,
      prompt: pronunciationPrompt({
        reference: row.seg.text,
        transcript: row.attempt.transcript,
        tokens: stored.tokens,
        wpm: row.attempt.wpm,
        refWpm: row.attempt.refWpm,
        pauses: stored.pauses,
      }),
      schema: PronunciationFeedbackSchema,
    })

    db.update(pronunciationAttempts)
      .set({ aiJson: JSON.stringify(feedback) })
      .where(eq(pronunciationAttempts.id, data.attemptId))
      .run()
    recordMistakes('pronunciation', row.seg.id, feedback.mistakes)
    return feedback
  })

export const pronunciationHistory = createServerFn({ method: 'GET' })
  .validator(z.object({ segmentId: z.number().int() }))
  .handler(async ({ data }) =>
    db
      .select({
        id: pronunciationAttempts.id,
        mode: pronunciationAttempts.mode,
        transcript: pronunciationAttempts.transcript,
        accuracy: pronunciationAttempts.accuracy,
        completeness: pronunciationAttempts.completeness,
        wpm: pronunciationAttempts.wpm,
        createdAt: pronunciationAttempts.createdAt,
      })
      .from(pronunciationAttempts)
      .where(eq(pronunciationAttempts.segmentId, data.segmentId))
      .orderBy(desc(pronunciationAttempts.createdAt))
      .limit(10)
      .all(),
  )
