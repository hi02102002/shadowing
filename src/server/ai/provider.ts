import { chat } from '@tanstack/ai'
import { createOpenaiChat } from '@tanstack/ai-openai'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { createAnthropicChat } from '@tanstack/ai-anthropic'
import { createGeminiChat } from '@tanstack/ai-gemini'
import { createOllamaChat } from '@tanstack/ai-ollama'
import type { z } from 'zod'

import { getConfig } from '../config.ts'
import type { AppConfig } from '../config.ts'

/**
 * Factory duy nhất tạo text adapter của TanStack AI theo cấu hình.
 * Model name là chuỗi tuỳ ý người dùng nhập nên ép kiểu `any` cho các adapter có danh sách model cố định.
 */
export function textAdapter(cfg: AppConfig = getConfig()) {
  const model = cfg.llmModel as any
  const baseURL = cfg.llmBaseUrl || undefined
  switch (cfg.llmProvider) {
    case 'openai':
      return createOpenaiChat(model, requireKey(cfg), baseURL ? { baseURL } : undefined)
    case 'anthropic':
      return createAnthropicChat(model, requireKey(cfg), baseURL ? ({ baseURL } as any) : undefined)
    case 'gemini':
      return createGeminiChat(model, requireKey(cfg))
    case 'ollama':
      return createOllamaChat(cfg.llmModel, { baseURL: baseURL ?? 'http://localhost:11434' })
    case 'openai-compatible':
      if (!baseURL) throw new Error('Cần nhập Base URL cho provider OpenAI-compatible')
      return openaiCompatibleText(cfg.llmModel, { baseURL, apiKey: cfg.llmApiKey || 'none' })
  }
}

function requireKey(cfg: AppConfig) {
  if (!cfg.llmApiKey) throw new Error(`Chưa cấu hình API key cho ${cfg.llmProvider}. Vào trang Cài đặt để nhập.`)
  return cfg.llmApiKey
}

/** Gọi LLM và nhận về object đã validate theo zod schema */
export async function structured<T extends z.ZodType>(opts: {
  system: string
  prompt: string
  schema: T
  cfg?: AppConfig
}): Promise<z.infer<T>> {
  const result = await chat({
    adapter: textAdapter(opts.cfg) as any,
    systemPrompts: [opts.system],
    messages: [{ role: 'user', content: opts.prompt }],
    outputSchema: opts.schema,
  })
  return opts.schema.parse(result)
}

/** Stream văn bản thuần (dùng cho test kết nối, gợi ý tự do) */
export async function* streamText(opts: { system: string; prompt: string; cfg?: AppConfig }) {
  const stream = chat({
    adapter: textAdapter(opts.cfg) as any,
    systemPrompts: [opts.system],
    messages: [{ role: 'user', content: opts.prompt }],
    stream: true,
  })
  for await (const chunk of stream as AsyncIterable<any>) {
    if (chunk.type === 'TEXT_MESSAGE_CONTENT' && chunk.delta) yield chunk.delta as string
    else if (chunk.type === 'content' && chunk.delta) yield chunk.delta as string
  }
}
