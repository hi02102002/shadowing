import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { lookups, segments, videos } from '#/db/schema.ts'
import type { DictEntry } from '../dunno.ts'
import { googleTranslateLines } from '../translate.ts'
import { collectWords, findPhrases, savedFronts } from '../vocab-words.ts'
import type { PhrasesResult, VocabWord } from '../vocab-words.ts'

export type { VocabWord }

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

/** từ đơn trong transcript kèm cấp CEFR (CEFR-J + Octanove), theo thứ tự xuất hiện */
export const videoVocab = createServerFn({ method: 'GET' })
  .validator(z.object({ youtubeId: z.string() }))
  .handler(async ({ data }): Promise<VocabWord[]> => collectWords(videoSegments(data.youtubeId), savedFronts()))

export type { VocabPhrase } from '../vocab-words.ts'

/**
 * Cụm từ (phrasal verb, thành ngữ, collocation) trong video và từ loại theo ngữ cảnh của từ đơn, do AI chọn;
 * video dài chia nhiều phần gọi song song. Tra một lần rồi cache.
 * Chỉ gọi AI khi người dùng bấm (`generate`), còn lại chỉ trả kết quả đã cache.
 * Bỏ cụm AI báo sai câu; surface không khớp nguyên văn thì để rỗng (không luyện gõ được).
 */
export const videoPhrases = createServerFn({ method: 'POST' })
  .validator(z.object({ youtubeId: z.string(), generate: z.boolean().default(false) }))
  .handler(
    async ({ data }): Promise<PhrasesResult> => {
      return findPhrases(`phrases2|${data.youtubeId}`, videoSegments(data.youtubeId), data.generate)
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
