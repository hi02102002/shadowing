/** Tra từ (từ điển dunno.ai + nghĩa theo ngữ cảnh bằng AI) có cache trong bảng lookups — chỉ chạy ở server */
import { eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { lookups } from '#/db/schema.ts'
import { LOOKUP_SYSTEM, LookupSchema, lookupPrompt } from './ai/prompts.ts'
import type { Lookup } from './ai/prompts.ts'
import { structured } from './ai/provider.ts'
import { getConfig, hasLlm } from './config.ts'
import { dunnoLookup } from './dunno.ts'
import type { DictEntry } from './dunno.ts'

export const cleanWord = (text: string) =>
  text.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')

/** Tra từ điển Anh–Việt (dunno.ai, không cần AI) có cache; null khi không có từ này */
export async function dictionaryLookup(raw: string): Promise<DictEntry | null> {
  const text = cleanWord(raw).toLowerCase()
  if (!text) throw new Error('Không có từ để tra')
  // dunno2: thêm ví dụ, collocation, họ từ → không dùng lại cache cũ thiếu các trường này
  const key = `dunno2|${text}`

  const cached = db.select().from(lookups).where(eq(lookups.key, key)).get()
  if (cached) return JSON.parse(cached.json) as DictEntry | null

  const entry = await dunnoLookup(text)
  const json = JSON.stringify(entry)
  db.insert(lookups)
    .values({ key, json })
    .onConflictDoUpdate({ target: lookups.key, set: { json } })
    .run()
  return entry
}

/** Nghĩa theo ngữ cảnh câu bằng AI, có cache; null khi chưa cấu hình AI (hoặc `cachedOnly` mà chưa tra) */
export async function contextLookup(
  raw: string,
  sentence: string,
  opts: { cachedOnly?: boolean } = {},
): Promise<Lookup | null> {
  const text = cleanWord(raw)
  if (!text) throw new Error('Không có từ để tra')
  const key = `${text.toLowerCase()}|${sentence.trim().toLowerCase()}`

  const cached = db.select().from(lookups).where(eq(lookups.key, key)).get()
  if (cached) {
    const parsed = LookupSchema.safeParse(JSON.parse(cached.json))
    if (parsed.success) return parsed.data
  }

  // chưa cấu hình AI: thẻ tra từ chỉ dùng từ điển (dictionaryEntry)
  if (opts.cachedOnly || !hasLlm(getConfig())) return null

  const result = await structured({
    system: LOOKUP_SYSTEM,
    prompt: lookupPrompt(text, sentence),
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
}
