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
  DRILL_FOCUS,
  PronunciationFeedbackSchema,
  pronunciationPrompt,
  pronunciationSystem,
} from '../ai/prompts.ts'
import type { DrillFocus, PronunciationFeedback } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { toWav16k } from '../audio.ts'
import { getConfig, hasAudioLlm, hasLlm, hasStt } from '../config.ts'
import type { AppConfig } from '../config.ts'
import { recordMistakes } from '../mistakes.ts'
import { transcribeOnDevice } from '../on-device-stt.ts'
import { transcribe } from '../stt.ts'
import type { SttWord } from '../stt.ts'
import {
  whisperBinary,
  whisperLocalStatus,
  PRONUNCIATION_MODEL,
} from '../whisper-local.ts'

const RECORDINGS_DIR = path.resolve(
  process.env.DATA_DIR ?? 'data',
  'recordings',
)
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

/** llm-audio / stt dùng API đã cấu hình; local = whisper.cpp trên máy (không cần AI) */
const ENGINES = ['llm-audio', 'stt', 'local'] as const
export type PronunciationEngine = (typeof ENGINES)[number]

/** lý do không dùng được, null = dùng được */
function engineUnavailable(
  engine: PronunciationEngine,
  cfg: AppConfig,
): string | null {
  switch (engine) {
    case 'llm-audio':
      return hasAudioLlm(cfg)
        ? null
        : 'Cần provider nghe được audio (Gemini / OpenAI / OpenAI-compatible) trong Cài đặt'
    case 'stt':
      return hasStt(cfg)
        ? null
        : 'Chưa nhập STT API key / Base URL trong Cài đặt'
    case 'local':
      return whisperBinary() ? null : 'Không tìm thấy whisper-cli trên máy này'
  }
}

/** Tự động: theo Cài đặt, thiếu cấu hình thì lùi dần LLM nghe audio → STT API → Whisper trên máy */
function autoEngine(cfg: AppConfig): PronunciationEngine {
  const order: PronunciationEngine[] =
    cfg.pronunciationEngine === 'llm-audio'
      ? ['llm-audio', 'stt', 'local']
      : ['stt', 'local']
  return order.find((e) => !engineUnavailable(e, cfg)) ?? 'local'
}

const PICKABLE: PronunciationEngine[] = ['llm-audio', 'local']

export const pronunciationEngines = createServerFn({ method: 'GET' }).handler(
  async () => {
    const cfg = getConfig()
    return {
      auto: autoEngine(cfg),
      // các cách chọn được lúc ghi âm; STT API chỉ dùng qua "Tự động" khi Cài đặt chọn Whisper (STT)
      engines: PICKABLE.map((id) => ({
        id,
        unavailable: engineUnavailable(id, cfg),
      })),
      /** chấm trên máy lần đầu phải tải model */
      localModelReady:
        whisperLocalStatus(PRONUNCIATION_MODEL).model === 'ready',
    }
  },
)

/** Nhận dạng bản ghi bằng engine đã chọn; llm-audio trả kèm nhận xét trong cùng lần gọi */
async function hearRecording(
  audio: File,
  raw: Buffer,
  reference: string,
  choice: PronunciationEngine | 'auto',
  cfg: AppConfig,
  drill?: { focus?: DrillFocus; note?: string },
) {
  let transcript: string
  let words: SttWord[] = []
  let feedback: PronunciationFeedback | null = null
  let spokenSec = 0

  const engine = choice === 'auto' ? autoEngine(cfg) : choice
  const unavailable = engineUnavailable(engine, cfg)
  if (unavailable) throw new Error(unavailable)

  if (engine === 'llm-audio') {
    // model nghe trực tiếp: chữ nghe được + nhận xét trong một lần gọi
    const { wav, durationMs } = await toWav16k(raw)
    if (durationMs < 400) throw new Error('Bản ghi quá ngắn, hãy nói lại')
    const { transcript: text, ...rest } = await assessWithAudioLlm(
      wav,
      reference,
      cfg,
      drill,
    )
    transcript = text.trim()
    feedback = rest
    spokenSec = durationMs / 1000
  } else if (engine === 'local') {
    const { wav, durationMs } = await toWav16k(raw)
    if (durationMs < 400) throw new Error('Bản ghi quá ngắn, hãy nói lại')
    words = await transcribeOnDevice(wav)
    transcript = words.map((w) => w.word).join(' ')
    spokenSec = words.length ? words[words.length - 1].end - words[0].start : 0
  } else {
    const stt = await transcribe(audio, { cfg })
    transcript = stt.text.trim()
    words = stt.words
    spokenSec = words.length ? words[words.length - 1].end - words[0].start : 0
  }
  return { engine, transcript, words, feedback, spokenSec }
}

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
      engine: z
        .enum(['auto', ...ENGINES])
        .catch('auto')
        .parse(form.get('engine')),
      // trụ cột đang luyện: nhận xét AI bám vào đó
      focus: z
        .enum(DRILL_FOCUS)
        .optional()
        .catch(undefined)
        .parse(form.get('focus') ?? undefined),
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

    const heard = await hearRecording(
      data.audio,
      raw,
      seg.text,
      data.engine,
      cfg,
      { focus: data.focus },
    )
    const { engine, transcript, words, spokenSec } = heard
    // tắt tự phân tích: chỉ lấy chữ nghe được; bấm "Nhờ AI phân tích" sẽ phân tích lại và ghi Sổ lỗi
    const feedback = cfg.aiAnalysis === 'on' ? heard.feedback : null

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
      engine,
      /** có LLM để viết nhận xét chi tiết (pronunciationFeedback) */
      aiFeedback: hasLlm(cfg),
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

/** Chấm từ / câu luyện ở trang IPA và "Shadowing là gì?": không gắn với video nên không lưu lại */
export const assessDrill = createServerFn({ method: 'POST' })
  .validator((form: FormData) => {
    if (!(form instanceof FormData)) throw new Error('Dữ liệu không hợp lệ')
    const audio = form.get('audio')
    if (!(audio instanceof File) || audio.size === 0)
      throw new Error('Thiếu file ghi âm')
    if (audio.size > MAX_AUDIO_BYTES)
      throw new Error('File ghi âm quá lớn (tối đa 10MB)')
    return {
      audio,
      text: z.string().trim().min(1).max(200).parse(form.get('text')),
      // trụ cột đang luyện (sound/stress/intonation/rhythm) và lưu ý của bài, để nhận xét bám đúng phần đó
      focus: z
        .enum(DRILL_FOCUS)
        .optional()
        .parse(form.get('focus') ?? undefined),
      note: z
        .string()
        .trim()
        .max(200)
        .optional()
        .parse(form.get('note') ?? undefined),
    }
  })
  .handler(async ({ data }) => {
    const cfg = getConfig()
    const raw = Buffer.from(await data.audio.arrayBuffer())
    const drill = { focus: data.focus, note: data.note }
    const heard = await hearRecording(
      data.audio,
      raw,
      data.text,
      'auto',
      cfg,
      drill,
    )
    const result = alignWords(data.text, heard.transcript)

    const pauses: StoredWords['pauses'] = []
    for (let i = 0; i < heard.words.length - 1; i++) {
      const gap = Math.round(
        (heard.words[i + 1].start - heard.words[i].end) * 1000,
      )
      if (gap > 400) pauses.push({ after: heard.words[i].word.trim(), ms: gap })
    }
    const spokenCount =
      heard.words.length || displayWords(heard.transcript).length
    const wpm =
      spokenCount >= 2 && heard.spokenSec > 0
        ? Math.round((spokenCount / heard.spokenSec) * 60)
        : null

    // engine không nghe audio (STT / máy) chưa có nhận xét: nhờ LLM đọc chữ + chỗ khác biệt để nhận xét theo trụ cột
    let feedback = heard.feedback
    if (!feedback && data.focus && hasLlm(cfg)) {
      feedback = await structured({
        system: pronunciationSystem(cfg.accent),
        prompt: pronunciationPrompt({
          reference: data.text,
          transcript: heard.transcript,
          tokens: result.tokens,
          wpm,
          refWpm: null,
          pauses,
          focus: data.focus,
          note: data.note,
        }),
        schema: PronunciationFeedbackSchema,
      }).catch(() => null)
    }
    return {
      transcript: heard.transcript,
      accuracy: result.score,
      tokens: result.tokens,
      feedback,
      wpm,
      pauses,
    }
  })

export type DrillResult = Awaited<ReturnType<typeof assessDrill>>

export const pronunciationFeedback = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      attemptId: z.number().int(),
      focus: z.enum(DRILL_FOCUS).optional(),
    }),
  )
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
      system: pronunciationSystem(getConfig().accent),
      prompt: pronunciationPrompt({
        reference: row.seg.text,
        transcript: row.attempt.transcript,
        tokens: stored.tokens,
        wpm: row.attempt.wpm,
        refWpm: row.attempt.refWpm,
        pauses: stored.pauses,
        focus: data.focus,
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
  .handler(async ({ data }) => {
    const rows = db
      .select({
        id: pronunciationAttempts.id,
        mode: pronunciationAttempts.mode,
        transcript: pronunciationAttempts.transcript,
        accuracy: pronunciationAttempts.accuracy,
        completeness: pronunciationAttempts.completeness,
        wpm: pronunciationAttempts.wpm,
        wordsJson: pronunciationAttempts.wordsJson,
        aiJson: pronunciationAttempts.aiJson,
        createdAt: pronunciationAttempts.createdAt,
      })
      .from(pronunciationAttempts)
      .where(eq(pronunciationAttempts.segmentId, data.segmentId))
      .orderBy(desc(pronunciationAttempts.createdAt))
      .limit(10)
      .all()
    // chỉ gửi các từ sai/thiếu/thừa và lỗi AI đã nhận xét, để xem lại sai ở đâu
    return rows.map(({ wordsJson, aiJson, ...a }) => ({
      ...a,
      errors:
        parseJson<StoredWords>(wordsJson)?.tokens.filter(
          (t) => t.op !== 'correct',
        ) ?? [],
      mistakes:
        parseJson<PronunciationFeedback>(aiJson)?.mistakes.map((m) => ({
          word: m.word,
          heard: m.heard,
          type: m.type,
          explanation: m.explanation,
        })) ?? [],
    }))
  })

function parseJson<T>(json: string | null): T | null {
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

export type PronunciationEngines = Awaited<
  ReturnType<typeof pronunciationEngines>
>
