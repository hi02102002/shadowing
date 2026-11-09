import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { structured } from '../ai/provider.ts'
import { verifyVilaoTalk, vilaoTalkConfig } from '../ai/vilao-talk.ts'
import { settingsPatch } from '../settings-patch.ts'
import {
  AppConfigSchema,
  getConfig,
  publicConfig,
  saveConfig,
} from '../config.ts'

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
      candidate.talkVilaoApiKey &&
      (candidate.talkVilaoApiKey !== current.talkVilaoApiKey ||
        candidate.talkVilaoBaseUrl !== current.talkVilaoBaseUrl ||
        candidate.talkVilaoModel !== current.talkVilaoModel)
    ) {
      await verifyVilaoTalk(vilaoTalkConfig(candidate))
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
