import { getConfig } from '../config.ts'
import type { AppConfig } from '../config.ts'

export type VilaoTalkConfig = Pick<
  AppConfig,
  'talkVilaoApiKey' | 'talkVilaoBaseUrl' | 'talkVilaoModel'
>

export function vilaoTalkConfig(cfg: AppConfig = getConfig()): VilaoTalkConfig {
  if (!cfg.talkVilaoApiKey)
    throw new Error('Chưa nhập API key Vilao cho Nói với AI trong Cài đặt')
  const url = new URL(cfg.talkVilaoBaseUrl)
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'api.vilao.ai' ||
    url.pathname.replace(/\/$/, '') !== '/v1' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error('Base URL Vilao phải là https://api.vilao.ai/v1')
  }
  if (!cfg.talkVilaoModel.trim())
    throw new Error('Chưa chọn model Vilao cho Nói với AI')
  return cfg
}

export function vilaoDelta(data: string): string {
  if (data === '[DONE]') return ''
  const payload = JSON.parse(data) as {
    error?: { message?: string }
    choices?: Array<{
      delta?: { content?: string }
      finish_reason?: string | null
    }>
  }
  if (payload.error)
    throw new Error(payload.error.message || 'Vilao không trả lời được')
  const finish = payload.choices?.[0]?.finish_reason
  if (finish && finish !== 'stop')
    throw new Error(`Vilao dừng câu trả lời trước khi hoàn tất (${finish})`)
  return payload.choices?.[0]?.delta?.content ?? ''
}

export async function* streamVilaoTalk(
  system: string,
  prompt: string,
  config: VilaoTalkConfig = vilaoTalkConfig(),
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(
    `${config.talkVilaoBaseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.talkVilaoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.talkVilaoModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        stream: true,
        max_tokens: 180,
      }),
      signal,
    },
  )
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 350)
    throw new Error(
      `Vilao HTTP ${response.status}: ${detail || response.statusText}`,
    )
  }
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done = false
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replace(
        /\r\n/g,
        '\n',
      )
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, boundary).replace(/\r/g, '')
        buffer = buffer.slice(boundary + 2)
        const data = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')
        if (!data) continue
        if (data === '[DONE]') {
          done = true
          break
        }
        const delta = vilaoDelta(data)
        if (delta) yield delta
      }
      if (done) break
    }
    if (!done) throw new Error('Luồng Vilao kết thúc trước khi hoàn tất')
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

export async function verifyVilaoTalk(config: VilaoTalkConfig): Promise<void> {
  let output = ''
  for await (const delta of streamVilaoTalk(
    'Reply with one English word.',
    'Hello',
    config,
  ))
    output += delta
  if (!output.trim())
    throw new Error(
      'Model Vilao không trả nội dung. Kiểm tra model ID và quyền sử dụng.',
    )
}
