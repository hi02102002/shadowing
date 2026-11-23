import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { streamText, structured } from '../ai/provider.ts'
import { settingsPatch } from '../settings-patch.ts'
import {
  AppConfigSchema,
  getConfig,
  publicConfig,
  saveConfig,
  talkLlmConfig,
} from '../config.ts'
import type { AppConfig } from '../config.ts'

/** gọi thử một câu ngắn để chắc provider riêng của Nói với AI dùng được trước khi lưu */
async function verifyTalk(cfg: AppConfig) {
  let output = ''
  for await (const delta of streamText({
    system: 'Reply with one English word.',
    prompt: 'Hello',
    cfg: talkLlmConfig(cfg),
    feature: 'settings',
  }))
    output += delta
  if (!output.trim())
    throw new Error(
      'Model cho Nói với AI không trả nội dung. Kiểm tra model và API key.',
    )
}

export const getSettings = createServerFn({ method: 'GET' }).handler(async () =>
  publicConfig(getConfig()),
)

export type PublicSettings = Awaited<ReturnType<typeof getSettings>>

export const saveSettings = createServerFn({ method: 'POST' })
  .validator(AppConfigSchema.partial())
  .handler(async ({ data }) => {
    const patch = settingsPatch(data)
    const current = getConfig()
    const candidate = AppConfigSchema.parse({ ...current, ...patch })
    if (
      candidate.talkProvider &&
      (candidate.talkProvider !== current.talkProvider ||
        candidate.talkApiKey !== current.talkApiKey ||
        candidate.talkBaseUrl !== current.talkBaseUrl ||
        candidate.talkModel !== current.talkModel)
    ) {
      await verifyTalk(candidate)
    }
    saveConfig(patch)
    return publicConfig(getConfig())
  })

export const testLlm = createServerFn({ method: 'POST' }).handler(async () => {
  const started = Date.now()
  try {
    const res = await structured({
      feature: 'settings',
      system: 'You are a connection test. Reply with JSON only.',
      prompt: 'Return ok=true and the IPA of the word "water".',
      schema: z.object({ ok: z.boolean(), ipa: z.string() }),
    })
    return {
      ok: res.ok,
      message: `Kết nối thành công (${Date.now() - started}ms). IPA "water": ${res.ipa}`,
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
})
