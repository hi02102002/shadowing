import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { lookups } from '#/db/schema.ts'
import { LOOKUP_SYSTEM, LookupSchema, lookupPrompt } from '../ai/prompts.ts'
import type { Lookup } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'

export const lookupWord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      text: z.string().trim().min(1).max(80),
      sentence: z.string().max(600),
    }),
  )
  .handler(async ({ data }): Promise<Lookup> => {
    const text = data.text.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')
    if (!text) throw new Error('Không có từ để tra')
    const key = `${text.toLowerCase()}|${data.sentence.trim().toLowerCase()}`

    const cached = db.select().from(lookups).where(eq(lookups.key, key)).get()
    if (cached) {
      const parsed = LookupSchema.safeParse(JSON.parse(cached.json))
      if (parsed.success) return parsed.data
    }

    const result = await structured({
      system: LOOKUP_SYSTEM,
      prompt: lookupPrompt(text, data.sentence),
      schema: LookupSchema,
    })
    db.insert(lookups)
      .values({ key, json: JSON.stringify(result) })
      .onConflictDoUpdate({
        target: lookups.key,
        set: { json: JSON.stringify(result) },
      })
      .run()
    return result
  })
