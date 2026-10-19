import { generateTranscription } from '@tanstack/ai'
import { createOpenaiTranscription } from '@tanstack/ai-openai'

import { getConfig } from './config.ts'
import type { AppConfig } from './config.ts'

export interface SttWord {
  word: string
  start: number
  end: number
}
export interface SttResult {
  text: string
  duration?: number
  words: SttWord[]
  segments: Array<{ start: number; end: number; text: string }>
}

/**
 * Speech-to-text qua endpoint `/audio/transcriptions` chuẩn OpenAI
 * (OpenAI Whisper, Groq, whisper.cpp server, LocalAI…).
 */
export async function transcribe(
  audio: File | Blob,
  opts: { prompt?: string; cfg?: AppConfig } = {},
): Promise<SttResult> {
  const cfg = opts.cfg ?? getConfig()
  if (!cfg.sttApiKey && !cfg.sttBaseUrl) {
    throw new Error('Chưa cấu hình Speech-to-Text. Vào trang Cài đặt để nhập STT API key / Base URL.')
  }
  const adapter = createOpenaiTranscription(
    cfg.sttModel as any,
    cfg.sttApiKey || 'none',
    cfg.sttBaseUrl ? { baseURL: cfg.sttBaseUrl } : undefined,
  )
  const file =
    audio instanceof File ? audio : new File([audio], 'audio.webm', { type: audio.type || 'audio/webm' })

  const result = await generateTranscription({
    adapter,
    audio: file,
    language: 'en',
    // prompt giúp Whisper viết đúng tên riêng trong câu gốc, nhưng không nên đưa nguyên câu
    // vì model sẽ "chép" lại câu gốc dù người nói sai.
    ...(opts.prompt ? { prompt: opts.prompt } : {}),
    responseFormat: 'verbose_json',
    modelOptions: { timestamp_granularities: ['word', 'segment'] },
  } as any)

  return {
    text: result.text,
    duration: result.duration,
    words: result.words ?? [],
    segments: (result.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text })),
  }
}
