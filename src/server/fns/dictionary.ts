import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { lookups, segments } from '#/db/schema.ts'
import { LOOKUP_SYSTEM, LookupSchema, lookupPrompt } from '../ai/prompts.ts'
import type { Lookup } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { getConfig, hasLlm } from '../config.ts'
import { dunnoLookup } from '../dunno.ts'
import type { DictEntry } from '../dunno.ts'
import { wordsToIpa } from '../ipa.ts'
import { googleTranslateLines } from '../translate.ts'

const cleanWord = (text: string) =>
  text.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')

/** Tra từ điển Anh–Việt (dunno.ai, không cần AI); null khi không có từ này */
export const dictionaryEntry = createServerFn({ method: 'POST' })
  .validator(z.object({ text: z.string().trim().min(1).max(80) }))
  .handler(async ({ data }): Promise<DictEntry | null> => {
    const text = cleanWord(data.text).toLowerCase()
    if (!text) throw new Error('Không có từ để tra')
    const key = `dunno|${text}`

    const cached = db.select().from(lookups).where(eq(lookups.key, key)).get()
    if (cached) return JSON.parse(cached.json) as DictEntry | null

    const entry = await dunnoLookup(text)
    const json = JSON.stringify(entry)
    db.insert(lookups)
      .values({ key, json })
      .onConflictDoUpdate({ target: lookups.key, set: { json } })
      .run()
    return entry
  })

export const lookupWord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      text: z.string().trim().min(1).max(80),
      sentence: z.string().max(600),
    }),
  )
  .handler(async ({ data }): Promise<Lookup | null> => {
    const text = cleanWord(data.text)
    if (!text) throw new Error('Không có từ để tra')
    const key = `${text.toLowerCase()}|${data.sentence.trim().toLowerCase()}`

    const cached = db.select().from(lookups).where(eq(lookups.key, key)).get()
    if (cached) {
      const parsed = LookupSchema.safeParse(JSON.parse(cached.json))
      if (parsed.success) return parsed.data
    }

    // chưa cấu hình AI: thẻ tra từ chỉ dùng từ điển (dictionaryEntry)
    if (!hasLlm(getConfig())) return null

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

/** Phiên âm IPA cho từng từ trong câu (từ điển CMU, không cần AI) */
export const wordsIpa = createServerFn({ method: 'POST' })
  .validator(z.object({ words: z.array(z.string().max(80)).max(300) }))
  .handler(async ({ data }) => wordsToIpa(data.words, getConfig().accent))

const translationKey = (text: string) => `gtranslate|vi|${text}`

/** đang dịch cả video → các câu khác của cùng video chờ chung, không gọi Google thêm lần nữa */
const inflight = new Map<number, Promise<void>>()

/** Dịch mọi câu chưa có bản dịch của một video trong vài lần gọi (thay vì mỗi câu một lần → dễ bị Google chặn) */
async function translateVideo(videoId: number) {
  const pending = db
    .select({ text: segments.text })
    .from(segments)
    .where(eq(segments.videoId, videoId))
    .orderBy(asc(segments.startMs))
    .all()
    .map((r) => r.text)
    .filter((text, i, all) => all.indexOf(text) === i)
    .filter(
      (text) =>
        !db
          .select({ key: lookups.key })
          .from(lookups)
          .where(eq(lookups.key, translationKey(text)))
          .get(),
    )
  if (!pending.length) return

  const translated = await googleTranslateLines(pending)
  db.transaction((tx) => {
    pending.forEach((text, i) =>
      tx
        .insert(lookups)
        .values({
          key: translationKey(text),
          json: JSON.stringify(translated[i]),
        })
        .onConflictDoNothing()
        .run(),
    )
  })
}

/** Dịch câu sang tiếng Việt bằng Google Dịch (miễn phí); dịch luôn cả video và lưu cache từng câu */
export const translateSentence = createServerFn({ method: 'POST' })
  .validator(z.object({ segmentId: z.number().int() }))
  .handler(async ({ data }): Promise<string> => {
    const seg = db
      .select()
      .from(segments)
      .where(eq(segments.id, data.segmentId))
      .get()
    if (!seg) throw new Error('Không tìm thấy câu')
    const read = () =>
      db
        .select()
        .from(lookups)
        .where(eq(lookups.key, translationKey(seg.text)))
        .get()
    const cached = read()
    if (cached) return JSON.parse(cached.json) as string

    let job = inflight.get(seg.videoId)
    if (!job) {
      job = translateVideo(seg.videoId).finally(() =>
        inflight.delete(seg.videoId),
      )
      inflight.set(seg.videoId, job)
    }
    await job
    const row = read()
    if (!row) throw new Error('Không dịch được câu này')
    return JSON.parse(row.json) as string
  })
