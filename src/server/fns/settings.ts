import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { structured } from '../ai/provider.ts'
import { AppConfigSchema, getConfig, publicConfig, saveConfig } from '../config.ts'

export const getSettings = createServerFn({ method: 'GET' }).handler(async () => publicConfig(getConfig()))

export type PublicSettings = Awaited<ReturnType<typeof getSettings>>

/** Key đã bị che (chứa "…") nghĩa là người dùng không sửa → giữ nguyên key cũ */
const keepIfMasked = (v: string | undefined) => (v && v.includes('…') ? undefined : v)

export const saveSettings = createServerFn({ method: 'POST' })
  .validator(AppConfigSchema.partial())
  .handler(async ({ data }) => {
    saveConfig({ ...data, llmApiKey: keepIfMasked(data.llmApiKey), sttApiKey: keepIfMasked(data.sttApiKey) })
    return publicConfig(getConfig())
  })

export const testLlm = createServerFn({ method: 'POST' }).handler(async () => {
  const started = Date.now()
  try {
    const res = await structured({
      system: 'You are a connection test. Reply with JSON only.',
      prompt: 'Return ok=true and the IPA of the word "water".',
      schema: z.object({ ok: z.boolean(), ipa: z.string() }),
    })
    return { ok: res.ok, message: `Kết nối thành công (${Date.now() - started}ms). IPA "water": ${res.ipa}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
})
