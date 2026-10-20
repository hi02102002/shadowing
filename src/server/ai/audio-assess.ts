import { z } from 'zod'

import { getConfig } from '../config.ts'
import type { AppConfig } from '../config.ts'
import {
  AUDIO_PRONUNCIATION_SYSTEM,
  AudioAssessmentSchema,
  audioPronunciationPrompt,
} from './prompts.ts'
import type { AudioAssessment } from './prompts.ts'

const GEMINI_OPENAI_BASE =
  'https://generativelanguage.googleapis.com/v1beta/openai'
const OPENAI_BASE = 'https://api.openai.com/v1'
const TIMEOUT_MS = 90_000

/**
 * Endpoint chat/completions tương thích OpenAI dùng để gửi audio.
 * TanStack AI chưa map AudioPart sang `input_audio`, nên chế độ này gọi thẳng API.
 */
function resolveEndpoint(cfg: AppConfig) {
  switch (cfg.llmProvider) {
    case 'openai-compatible':
      if (!cfg.llmBaseUrl)
        throw new Error('Cần nhập Base URL cho provider OpenAI-compatible')
      return cfg.llmBaseUrl
    case 'openai':
      return cfg.llmBaseUrl || OPENAI_BASE
    case 'gemini':
      return cfg.llmBaseUrl || GEMINI_OPENAI_BASE
    case 'anthropic':
    case 'ollama':
      throw new Error(
        `Provider ${cfg.llmProvider} không nghe được audio. Chọn Gemini / OpenAI-compatible, hoặc đổi "Chấm phát âm bằng" sang Whisper (STT) trong Cài đặt.`,
      )
  }
}

/** Bỏ ```json … ``` mà một số model vẫn bọc quanh JSON */
function extractJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  return JSON.parse(
    start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed,
  )
}

async function post(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(`${url.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
}

/**
 * Gửi bản ghi (WAV) + câu gốc cho model LLM nghe được audio.
 * Trả về chữ model nghe được và nhận xét phát âm trong một lần gọi.
 */
export async function assessWithAudioLlm(
  wav: Buffer,
  reference: string,
  cfg: AppConfig = getConfig(),
): Promise<AudioAssessment> {
  const url = resolveEndpoint(cfg)
  const messages = [
    { role: 'system', content: AUDIO_PRONUNCIATION_SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: audioPronunciationPrompt(reference) },
        {
          type: 'input_audio',
          input_audio: { data: wav.toString('base64'), format: 'wav' },
        },
      ],
    },
  ]
  const schema = z.toJSONSchema(AudioAssessmentSchema)

  let res = await post(url, cfg.llmApiKey, {
    model: cfg.llmModel,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'pronunciation_assessment', schema },
    },
  })
  // provider không hỗ trợ json_schema → thử lại, yêu cầu JSON trong prompt
  if (
    !res.ok &&
    res.status === 400 &&
    /response_format|json_schema|schema/i.test(res.text)
  ) {
    messages[0] = {
      role: 'system',
      content: `${AUDIO_PRONUNCIATION_SYSTEM}\n\nChỉ trả về một object JSON đúng schema sau, không kèm chữ nào khác:\n${JSON.stringify(schema)}`,
    }
    res = await post(url, cfg.llmApiKey, { model: cfg.llmModel, messages })
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error(
        `API key không hợp lệ (HTTP ${res.status}). Kiểm tra trong Cài đặt.`,
      )
    if (/audio|input_audio|modalit/i.test(res.text)) {
      throw new Error(
        `Model "${cfg.llmModel}" không nhận audio. Dùng model Gemini hoặc gpt-audio.`,
      )
    }
    throw new Error(
      `Gọi model lỗi HTTP ${res.status}: ${res.text.slice(0, 200)}`,
    )
  }

  const content = (
    JSON.parse(res.text) as {
      choices?: Array<{ message?: { content?: string } }>
    }
  ).choices?.[0]?.message?.content
  if (!content) throw new Error('Model không trả về nội dung')

  let json: unknown
  try {
    json = extractJson(content)
  } catch {
    // một số proxy không chuyển được input_audio nhưng vẫn trả HTTP 200 kèm lời báo lỗi dạng chữ,
    // vd. "Images are not supported by this model or could not be processed…"
    const reply = content.trim().slice(0, 160)
    if (/not supported|unsupported|could not be processed|cannot (process|hear)/i.test(content)) {
      throw new Error(
        `Model "${cfg.llmModel}" không nhận audio qua endpoint này (trả lời: "${reply}"). Dùng model/provider nghe được audio, hoặc đổi "Chấm phát âm bằng" sang Whisper (STT) trong Cài đặt.`,
      )
    }
    throw new Error(`Model không trả về JSON: "${reply}"`)
  }
  return AudioAssessmentSchema.parse(json)
}
