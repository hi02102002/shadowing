import { z } from 'zod'

import { getConfig } from '../config.ts'
import type { AppConfig } from '../config.ts'
import { extractJson, jsonInstruction } from './provider.ts'
import {
  AudioAssessmentSchema,
  audioPronunciationPrompt,
  audioPronunciationSystem,
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
export function assessWithAudioLlm(
  wav: Buffer,
  reference: string,
  cfg: AppConfig = getConfig(),
): Promise<AudioAssessment> {
  return audioStructured({
    wav,
    system: audioPronunciationSystem(cfg.accent),
    prompt: audioPronunciationPrompt(reference),
    schema: AudioAssessmentSchema,
    name: 'pronunciation_assessment',
    cfg,
  })
}

/** Gửi bản ghi (WAV) kèm câu hỏi cho model nghe được audio, nhận về object đã validate theo zod schema */
export async function audioStructured<T extends z.ZodType>(opts: {
  wav: Buffer
  system: string
  prompt: string
  schema: T
  /** tên schema gửi kèm response_format */
  name: string
  cfg?: AppConfig
}): Promise<z.infer<T>> {
  const cfg = opts.cfg ?? getConfig()
  const url = resolveEndpoint(cfg)
  const user = {
    role: 'user',
    content: [
      { type: 'text', text: opts.prompt },
      {
        type: 'input_audio',
        input_audio: { data: opts.wav.toString('base64'), format: 'wav' },
      },
    ],
  }
  // cùng câu hỏi nhưng không dùng response_format: schema nằm trong system prompt
  const jsonInPrompt = () =>
    post(url, cfg.llmApiKey, {
      model: cfg.llmModel,
      messages: [
        { role: 'system', content: jsonInstruction(opts.system, opts.schema) },
        user,
      ],
    })

  const res = await post(url, cfg.llmApiKey, {
    model: cfg.llmModel,
    messages: [{ role: 'system', content: opts.system }, user],
    response_format: {
      type: 'json_schema',
      json_schema: { name: opts.name, schema: z.toJSONSchema(opts.schema) },
    },
  })
  // provider không hỗ trợ json_schema → thử lại, yêu cầu JSON trong prompt
  if (
    !res.ok &&
    res.status === 400 &&
    /response_format|json_schema|schema/i.test(res.text)
  ) {
    return parseReply(await jsonInPrompt(), opts.schema, cfg)
  }

  try {
    return parseReply(res, opts.schema, cfg)
  } catch (err) {
    // một số proxy nhận response_format nhưng lặng lẽ bỏ qua → model trả markdown; dặn JSON trong prompt và hỏi lại
    if (!(err instanceof NotJsonError)) throw err
    return parseReply(await jsonInPrompt(), opts.schema, cfg)
  }
}

class NotJsonError extends Error {}

/** nội dung trả lời của model; HTTP lỗi thì báo lỗi dễ hiểu */
function replyContent(
  res: Awaited<ReturnType<typeof post>>,
  cfg: AppConfig,
): string {
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
  return content
}

function parseReply<T extends z.ZodType>(
  res: Awaited<ReturnType<typeof post>>,
  schema: T,
  cfg: AppConfig,
): z.infer<T> {
  const content = replyContent(res, cfg)
  let json: unknown
  try {
    json = extractJson(content)
  } catch {
    // một số proxy không chuyển được input_audio nhưng vẫn trả HTTP 200 kèm lời báo lỗi dạng chữ,
    // vd. "Images are not supported by this model or could not be processed…"
    const reply = content.trim().slice(0, 160)
    if (
      /not supported|unsupported|could not be processed|cannot (process|hear)/i.test(
        content,
      )
    ) {
      throw new Error(
        `Model "${cfg.llmModel}" không nhận audio qua endpoint này (trả lời: "${reply}"). Dùng model/provider nghe được audio, hoặc đổi "Chấm phát âm bằng" sang Whisper (STT) trong Cài đặt.`,
      )
    }
    throw new NotJsonError(`Model không trả về JSON: "${reply}"`)
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success)
    throw new NotJsonError('Model trả về JSON sai cấu trúc, hãy thử lại')
  return parsed.data
}

const TRANSCRIBE_SYSTEM = `You transcribe short recordings of a language learner speaking English.
Write exactly what the speaker says, keeping their grammar mistakes (do not correct them).
Output only the transcript as plain text: no quotes, no notes. If nothing intelligible is said, output an empty line.`

/** Chép lời nói tự do (không có câu mẫu) bằng model nghe được audio, dùng cho hội thoại */
export async function transcribeWithAudioLlm(
  wav: Buffer,
  cfg: AppConfig = getConfig(),
): Promise<string> {
  const res = await post(resolveEndpoint(cfg), cfg.llmApiKey, {
    model: cfg.llmModel,
    messages: [
      { role: 'system', content: TRANSCRIBE_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe this recording.' },
          {
            type: 'input_audio',
            input_audio: { data: wav.toString('base64'), format: 'wav' },
          },
        ],
      },
    ],
  })
  const content = replyContent(res, cfg)
  if (/not supported|unsupported|could not be processed|cannot (process|hear)/i.test(content))
    throw new Error(
      `Model "${cfg.llmModel}" không nhận audio qua endpoint này. Dùng model/provider nghe được audio, hoặc nhập STT trong Cài đặt.`,
    )
  return content.trim().replace(/^["“]|["”]$/g, '').trim()
}
