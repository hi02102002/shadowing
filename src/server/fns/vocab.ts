import { createServerFn } from '@tanstack/react-start'
import { asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { cards, lookups, segments, videos } from '#/db/schema.ts'
import type { DictEntry } from '../dunno.ts'
import type { VocabLevel } from '#/lib/levels.ts'
import { VIDEO_PHRASES_SYSTEM, VideoPhrasesSchema, videoPhrasesPrompt } from '../ai/prompts.ts'
import type { VideoPhrases } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { sentenceWords, wordLevel } from '../cefr/levels.ts'
import { getConfig, hasLlm } from '../config.ts'
import { googleTranslateLines } from '../translate.ts'

/** transcript gửi AI tìm cụm từ: video dài thì cắt bớt cho vừa một lượt gọi */
const MAX_TRANSCRIPT_CHARS = 24_000

function videoSegments(youtubeId: string) {
  const video = db.select({ id: videos.id }).from(videos).where(eq(videos.youtubeId, youtubeId)).get()
  if (!video) throw new Error('Không tìm thấy video')
  return db
    .select({ idx: segments.idx, text: segments.text })
    .from(segments)
    .where(eq(segments.videoId, video.id))
    .orderBy(asc(segments.idx))
    .all()
}

/** mặt trước các thẻ đã có (chữ thường) để đánh dấu từ đã lưu */
const savedFronts = () =>
  new Set(
    db
      .select({ front: sql<string>`lower(${cards.front})` })
      .from(cards)
      .all()
      .map((c) => c.front),
  )

export interface VocabWord {
  lemma: string
  level: VocabLevel
  /** từ loại theo CEFR-J (tiếng Anh: noun, verb…) */
  pos: string[]
  /** số lần xuất hiện trong video */
  count: number
  /** câu đầu tiên chứa từ và dạng từ trong câu đó, vd. lemma "negotiate", surface "negotiating" */
  segIdx: number
  surface: string
  saved: boolean
}

/** từ đơn trong transcript kèm cấp CEFR (CEFR-J + Octanove), theo thứ tự xuất hiện */
export const videoVocab = createServerFn({ method: 'GET' })
  .validator(z.object({ youtubeId: z.string() }))
  .handler(async ({ data }): Promise<VocabWord[]> => {
    const saved = savedFronts()
    const words = new Map<string, VocabWord>()
    for (const seg of videoSegments(data.youtubeId)) {
      for (const surface of sentenceWords(seg.text)) {
        const hit = wordLevel(surface)
        if (!hit) continue
        const word = words.get(hit.lemma)
        if (word) word.count++
        else
          words.set(hit.lemma, {
            ...hit,
            count: 1,
            segIdx: seg.idx,
            surface,
            saved: saved.has(hit.lemma) || saved.has(surface.toLowerCase()),
          })
      }
    }
    return [...words.values()]
  })

export type VocabPhrase = VideoPhrases['phrases'][number] & { saved: boolean }

/**
 * Cụm từ (phrasal verb, thành ngữ, collocation) trong video do AI chọn, tra một lần rồi cache.
 * Chỉ gọi AI khi người dùng bấm (`generate`), còn lại chỉ trả kết quả đã cache.
 * Bỏ cụm AI báo sai câu; surface không khớp nguyên văn thì để rỗng (không luyện gõ được).
 */
export const videoPhrases = createServerFn({ method: 'POST' })
  .validator(z.object({ youtubeId: z.string(), generate: z.boolean().default(false) }))
  .handler(
    async ({
      data,
    }): Promise<
      | { status: 'ready'; phrases: VocabPhrase[] }
      /** chưa tìm lần nào */
      | { status: 'idle' }
      | { status: 'no-ai' }
    > => {
    const key = `phrases1|${data.youtubeId}`
    const segs = videoSegments(data.youtubeId)

    let result: VideoPhrases | null = null
    const cached = db.select().from(lookups).where(eq(lookups.key, key)).get()
    if (cached) {
      const parsed = VideoPhrasesSchema.safeParse(JSON.parse(cached.json))
      if (parsed.success) result = parsed.data
    }
    if (!result) {
      if (!hasLlm(getConfig())) return { status: 'no-ai' }
      if (!data.generate) return { status: 'idle' }
      let lines = ''
      for (const s of segs) {
        const line = `[${s.idx}] ${s.text.replace(/\s+/g, ' ').trim()}\n`
        if (lines.length + line.length > MAX_TRANSCRIPT_CHARS) break
        lines += line
      }
      result = await structured({
        system: VIDEO_PHRASES_SYSTEM,
        prompt: videoPhrasesPrompt(lines),
        schema: VideoPhrasesSchema,
      })
      const json = JSON.stringify(result)
      db.insert(lookups).values({ key, json }).onConflictDoUpdate({ target: lookups.key, set: { json } }).run()
    }

    const text = new Map(segs.map((s) => [s.idx, s.text.toLowerCase()]))
    const saved = savedFronts()
    const seen = new Set<string>()
    const phrases = result.phrases.flatMap((p) => {
      const sentence = text.get(p.segment)
      const phrase = p.phrase.trim()
      if (!sentence || !phrase || seen.has(phrase.toLowerCase())) return []
      seen.add(phrase.toLowerCase())
      const surface = [p.surface, phrase].map((s) => s.trim()).find((s) => s && sentence.includes(s.toLowerCase()))
      return [{ ...p, phrase, surface: surface ?? '', saved: saved.has(phrase.toLowerCase()) }]
    })
    return { status: 'ready', phrases }
  },
  )

const cachedJson = <T>(key: string) => {
  const row = db.select({ json: lookups.json }).from(lookups).where(eq(lookups.key, key)).get()
  return row ? (JSON.parse(row.json) as T) : undefined
}

/**
 * Nghĩa tiếng Việt ngắn cho danh sách từ: dùng từ điển dunno.ai nếu từ đã từng tra (có cache),
 * còn lại dịch cả lô một lần bằng Google Dịch (miễn phí, cache theo từ) để không bị giới hạn số lần tra.
 */
export const vocabMeanings = createServerFn({ method: 'POST' })
  .validator(z.object({ words: z.array(z.string().trim().min(1).max(80)).max(1000) }))
  .handler(async ({ data }) => {
    const meanings: Record<string, string> = {}
    const missing: string[] = []
    for (const word of new Set(data.words.map((w) => w.toLowerCase()))) {
      const dict = cachedJson<DictEntry | null>(`dunno2|${word}`)
      const fromDict = dict?.senses
        .filter((s) => !s.specialized)
        .slice(0, 2)
        .map((s) => s.means.slice(0, 2).join(', '))
        .join('; ')
      const translated = cachedJson<string>(`gtranslate|vi|${word}`)
      const meaning = fromDict || translated
      if (meaning) meanings[word] = meaning
      else missing.push(word)
    }
    if (missing.length) {
      const translated = await googleTranslateLines(missing).catch(() => null)
      if (translated)
        db.transaction((tx) => {
          missing.forEach((word, i) => {
            const vi = translated[i]?.trim()
            if (!vi) return
            meanings[word] = vi
            tx.insert(lookups)
              .values({ key: `gtranslate|vi|${word}`, json: JSON.stringify(vi) })
              .onConflictDoNothing()
              .run()
          })
        })
    }
    // Google hay viết hoa chữ đầu ("Thành thật") → đưa về chữ thường như nghĩa từ điển
    for (const [word, vi] of Object.entries(meanings)) meanings[word] = vi.charAt(0).toLowerCase() + vi.slice(1)
    return meanings
  })
