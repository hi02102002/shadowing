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

/** transcript gửi AI mỗi lượt gọi; video dài chia thành nhiều phần gọi song song */
const CHUNK_CHARS = 15_000
/** số lượt gọi AI tối đa cho một video (video 1–2 giờ) */
const MAX_CHUNKS = 8

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

/** từ đơn (theo dạng gốc) trong các câu, theo thứ tự xuất hiện */
function collectWords(segs: Array<{ idx: number; text: string }>, saved: Set<string>) {
  const words = new Map<string, VocabWord>()
  for (const seg of segs) {
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
}

/** từ đơn trong transcript kèm cấp CEFR (CEFR-J + Octanove), theo thứ tự xuất hiện */
export const videoVocab = createServerFn({ method: 'GET' })
  .validator(z.object({ youtubeId: z.string() }))
  .handler(async ({ data }): Promise<VocabWord[]> => collectWords(videoSegments(data.youtubeId), savedFronts()))

export type VocabPhrase = VideoPhrases['phrases'][number] & { saved: boolean }

/** chia transcript thành các phần ≤ CHUNK_CHARS (mỗi dòng "[idx] câu") */
export function chunkSegments(segs: Array<{ idx: number; text: string }>) {
  const chunks: Array<typeof segs> = [[]]
  let size = 0
  for (const s of segs) {
    const len = s.text.length + 8
    if (size + len > CHUNK_CHARS && chunks[chunks.length - 1].length) {
      if (chunks.length === MAX_CHUNKS) break
      chunks.push([])
      size = 0
    }
    chunks[chunks.length - 1].push(s)
    size += len
  }
  return chunks
}

/** một lượt AI cho một phần transcript: cụm từ + từ loại theo ngữ cảnh của các từ từ A2 trở lên xuất hiện lần đầu ở phần này */
function askChunk(chunk: Array<{ idx: number; text: string }>, seen: Set<string>) {
  const lines = chunk.map((s) => `[${s.idx}] ${s.text.replace(/\s+/g, ' ').trim()}`).join('\n')
  const words = collectWords(chunk, new Set())
    .filter((w) => w.level !== 'A1' && !seen.has(w.lemma))
    .map((w) => {
      seen.add(w.lemma)
      return `${w.lemma} | ${w.surface} | ${w.segIdx}`
    })
    .join('\n')
  return structured({
    system: VIDEO_PHRASES_SYSTEM,
    prompt: videoPhrasesPrompt(lines, words),
    schema: VideoPhrasesSchema,
  })
}

/**
 * Cụm từ (phrasal verb, thành ngữ, collocation) trong video và từ loại theo ngữ cảnh của từ đơn, do AI chọn;
 * video dài chia nhiều phần gọi song song. Tra một lần rồi cache.
 * Chỉ gọi AI khi người dùng bấm (`generate`), còn lại chỉ trả kết quả đã cache.
 * Bỏ cụm AI báo sai câu; surface không khớp nguyên văn thì để rỗng (không luyện gõ được).
 */
export const videoPhrases = createServerFn({ method: 'POST' })
  .validator(z.object({ youtubeId: z.string(), generate: z.boolean().default(false) }))
  .handler(
    async ({
      data,
    }): Promise<
      | {
          status: 'ready'
          phrases: VocabPhrase[]
          /** dạng gốc → từ loại theo ngữ cảnh (noun, verb…) */
          wordPos: Record<string, string>
        }
      /** chưa tìm lần nào */
      | { status: 'idle' }
      | { status: 'no-ai' }
    > => {
      const key = `phrases2|${data.youtubeId}`
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
        const seen = new Set<string>()
        const parts = await Promise.all(chunkSegments(segs).map((chunk) => askChunk(chunk, seen)))
        result = { phrases: parts.flatMap((p) => p.phrases), words: parts.flatMap((p) => p.words) }
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
      const wordPos = Object.fromEntries(result.words.map((w) => [w.word.trim().toLowerCase(), w.pos]))
      return { status: 'ready', phrases, wordPos }
    },
  )

/** danh sách chỉ cần nghĩa ngắn gọn một dòng */
const shortMeaning = (s: string | undefined) => (s && s.length > 60 ? `${s.slice(0, 57).trimEnd()}…` : s)

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
      // nghĩa ngắn cho danh sách: 2 nghĩa đầu của nghĩa thông dụng đầu tiên, bỏ ghi chú "(thực vật học)"
      const fromDict = shortMeaning(
        dict?.senses
          .find((s) => !s.specialized)
          ?.means.map((m) => m.replace(/\([^)]*\)/g, '').trim())
          .filter(Boolean)
          .slice(0, 2)
          .join(', '),
      )
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
