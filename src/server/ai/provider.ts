import { chat } from '@tanstack/ai'
import { createOpenaiChat } from '@tanstack/ai-openai'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { createAnthropicChat } from '@tanstack/ai-anthropic'
import { createGeminiChat } from '@tanstack/ai-gemini'
import { createOllamaChat } from '@tanstack/ai-ollama'
import { toJSONSchema, ZodError } from 'zod'
import type { z } from 'zod'

import { getConfig } from '../config.ts'
import type { AppConfig } from '../config.ts'

interface UsageMeta {
  feature?: string
  cfg?: AppConfig
}

/** ghi một lượt gọi vào bảng ai_usage; không bao giờ làm hỏng lượt gọi AI chính */
async function recordUsage(row: {
  cfg: AppConfig
  feature: string
  prompt: number
  completion: number
  total: number
  estimated: boolean
  ok: boolean
  durationMs: number
}) {
  if (process.env.VITEST) return
  try {
    const [{ db }, { aiUsage }] = await Promise.all([
      import('#/db/index.ts'),
      import('#/db/schema.ts'),
    ])
    db.insert(aiUsage)
      .values({
        provider: row.cfg.llmProvider,
        model: row.cfg.llmModel,
        feature: row.feature,
        promptTokens: row.prompt,
        completionTokens: row.completion,
        totalTokens: row.total,
        estimated: row.estimated,
        ok: row.ok,
        durationMs: row.durationMs,
      })
      .run()
  } catch {
    // tracking là phụ, bỏ qua lỗi ghi
  }
}

/** ~4 ký tự / token: đủ để so sánh tương đối khi provider không báo usage */
const estimateTokens = (text: string) => Math.ceil(text.length / 4)

/**
 * Chạy một lượt gọi chat, gom usage qua middleware onUsage của TanStack AI.
 * Nếu provider không báo usage thì ước lượng từ độ dài prompt / kết quả.
 */
async function tracked<T>(
  meta: UsageMeta,
  promptText: string,
  run: (middleware: Array<any>) => Promise<T>,
  outputText: (result: T) => string,
): Promise<T> {
  const cfg = meta.cfg ?? getConfig()
  const started = Date.now()
  let prompt = 0
  let completion = 0
  let total = 0
  let reported = false
  const middleware = [
    {
      name: 'usage-tracker',
      onUsage: (_ctx: unknown, u: any) => {
        reported = true
        prompt += u?.promptTokens ?? 0
        completion += u?.completionTokens ?? 0
        total += u?.totalTokens ?? (u?.promptTokens ?? 0) + (u?.completionTokens ?? 0)
      },
    },
  ]
  let result: T | undefined
  let ok = true
  try {
    result = await run(middleware)
    return result
  } catch (err) {
    ok = false
    throw err
  } finally {
    if (!reported) {
      prompt = estimateTokens(promptText)
      completion = result === undefined ? 0 : estimateTokens(outputText(result))
      total = prompt + completion
    }
    void recordUsage({
      cfg,
      feature: meta.feature ?? 'other',
      prompt,
      completion,
      total,
      estimated: !reported,
      ok,
      durationMs: Date.now() - started,
    })
  }
}

/**
 * Factory duy nhất tạo text adapter của TanStack AI theo cấu hình.
 * Model name là chuỗi tuỳ ý người dùng nhập nên ép kiểu `any` cho các adapter có danh sách model cố định.
 */
export function textAdapter(cfg: AppConfig = getConfig()) {
  const model = cfg.llmModel as any
  const baseURL = cfg.llmBaseUrl || undefined
  switch (cfg.llmProvider) {
    case 'openai':
      return createOpenaiChat(
        model,
        requireKey(cfg),
        baseURL ? { baseURL } : undefined,
      )
    case 'anthropic':
      return createAnthropicChat(
        model,
        requireKey(cfg),
        baseURL ? ({ baseURL } as any) : undefined,
      )
    case 'gemini':
      return createGeminiChat(model, requireKey(cfg))
    case 'ollama':
      return createOllamaChat(cfg.llmModel, {
        baseURL: baseURL ?? 'http://localhost:11434',
      })
    case 'openai-compatible':
      if (!baseURL)
        throw new Error('Cần nhập Base URL cho provider OpenAI-compatible')
      return openaiCompatibleText(cfg.llmModel, {
        baseURL,
        apiKey: cfg.llmApiKey || 'none',
      })
  }
}

function requireKey(cfg: AppConfig) {
  if (!cfg.llmApiKey)
    throw new Error(
      `Chưa cấu hình API key cho ${cfg.llmProvider}. Vào trang Cài đặt để nhập.`,
    )
  return cfg.llmApiKey
}

/** Bỏ ```json … ``` và lời dẫn mà một số model vẫn bọc quanh JSON */
export function extractJson(text: string): unknown {
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

/** dặn trả JSON ngay trong system prompt, cho provider không hỗ trợ (hoặc lặng lẽ bỏ qua) structured output */
export const jsonInstruction = (system: string, schema: z.ZodType) =>
  `${system}\n\nChỉ trả về một object JSON đúng schema sau, không markdown, không kèm chữ nào khác:\n${JSON.stringify(toJSONSchema(schema))}`

/** lỗi do model không trả đúng JSON (đáng hỏi lại), khác lỗi mạng / API key */
const isOutputError = (err: unknown) =>
  err instanceof ZodError ||
  err instanceof SyntaxError ||
  (err instanceof Error && /structured output|JSON/i.test(err.message))

/** Gọi LLM và nhận về object đã validate theo zod schema */
export async function structured<T extends z.ZodType>(opts: {
  system: string
  prompt: string
  schema: T
  cfg?: AppConfig
  /** tên tính năng để thống kê usage */
  feature?: string
}): Promise<z.infer<T>> {
  const adapter = textAdapter(opts.cfg) as any
  const messages = [{ role: 'user' as const, content: opts.prompt }]
  const meta = { feature: opts.feature, cfg: opts.cfg }
  const promptText = `${opts.system}\n${opts.prompt}`
  try {
    const result = await tracked(
      meta,
      promptText,
      (middleware) =>
        chat({
          adapter,
          systemPrompts: [opts.system],
          messages,
          outputSchema: opts.schema,
          middleware,
        } as any) as unknown as Promise<unknown>,
      (r) => JSON.stringify(r),
    )
    return opts.schema.parse(result)
  } catch (err) {
    // một số provider / proxy nhận structured output nhưng model vẫn trả markdown → dặn JSON trong prompt và hỏi lại
    if (!isOutputError(err)) throw err
    const { text } = await tracked(
      meta,
      promptText,
      (middleware) =>
        chat({
          adapter,
          systemPrompts: [jsonInstruction(opts.system, opts.schema)],
          messages,
          stream: false,
          middleware,
        } as any) as unknown as Promise<{ text: string }>,
      (r) => r.text,
    )
    try {
      return opts.schema.parse(extractJson(text))
    } catch {
      throw new Error(
        `Model không trả về JSON đúng cấu trúc: "${text.trim().slice(0, 160)}"`,
      )
    }
  }
}

/** Stream văn bản thuần (dùng cho test kết nối, gợi ý tự do) */
export async function* streamText(opts: {
  system: string
  prompt: string
  cfg?: AppConfig
  feature?: string
}) {
  const cfg = opts.cfg ?? getConfig()
  const started = Date.now()
  let prompt = 0
  let completion = 0
  let reported = false
  let out = ''
  let ok = true
  const middleware = [
    {
      name: 'usage-tracker',
      onUsage: (_ctx: unknown, u: any) => {
        reported = true
        prompt += u?.promptTokens ?? 0
        completion += u?.completionTokens ?? 0
      },
    },
  ]
  try {
    const stream = chat({
      adapter: textAdapter(opts.cfg) as any,
      systemPrompts: [opts.system],
      messages: [{ role: 'user', content: opts.prompt }],
      stream: true,
      middleware,
    } as any)
    for await (const chunk of stream as AsyncIterable<any>) {
      const delta =
        (chunk.type === 'TEXT_MESSAGE_CONTENT' || chunk.type === 'content') &&
        chunk.delta
          ? (chunk.delta as string)
          : ''
      if (delta) {
        out += delta
        yield delta
      }
    }
  } catch (err) {
    ok = false
    throw err
  } finally {
    if (!reported) {
      prompt = estimateTokens(`${opts.system}\n${opts.prompt}`)
      completion = estimateTokens(out)
    }
    void recordUsage({
      cfg,
      feature: opts.feature ?? 'other',
      prompt,
      completion,
      total: prompt + completion,
      estimated: !reported,
      ok,
      durationMs: Date.now() - started,
    })
  }
}
