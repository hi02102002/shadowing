/**
 * Từ đơn kèm cấp CEFR và cụm từ do AI tìm trong các câu (transcript video, bài đọc). Module riêng chỉ chạy ở server:
 * file server function được client import, mọi export thường ở đó kéo cả db và danh sách CEFR vào bundle trình duyệt.
 */
import { eq, sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { cards, lookups } from '#/db/schema.ts'
import type { VocabLevel } from '#/lib/levels.ts'
import { VIDEO_PHRASES_SYSTEM, VideoPhrasesSchema, videoPhrasesPrompt } from './ai/prompts.ts'
import type { VideoPhrases } from './ai/prompts.ts'
import { structured } from './ai/provider.ts'
import { sentenceWords, wordLevel } from './cefr/levels.ts'
import { getConfig, hasLlm } from './config.ts'

/** transcript gửi AI mỗi lượt gọi; video dài chia thành nhiều phần gọi song song */
const CHUNK_CHARS = 15_000
/** số lượt gọi AI tối đa cho một video (video 1–2 giờ) */
const MAX_CHUNKS = 8

/** mặt trước các thẻ đã có (chữ thường) để đánh dấu từ đã lưu */
export const savedFronts = () =>
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

/** từ đơn (theo dạng gốc) trong các câu, theo thứ tự xuất hiện (dùng cả cho bài đọc: mỗi câu là một "segment") */
export function collectWords(segs: Array<{ idx: number; text: string }>, saved: Set<string>) {
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


/** chia các câu thành các phần ≤ CHUNK_CHARS (mỗi dòng "[idx] câu") */
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

export type VocabPhrase = VideoPhrases['phrases'][number] & { saved: boolean }

export type PhrasesResult =
  | {
      status: 'ready'
      phrases: VocabPhrase[]
      /** dạng gốc → từ loại theo ngữ cảnh (noun, verb…) */
      wordPos: Record<string, string>
    }
  /** chưa tìm lần nào */
  | { status: 'idle' }
  | { status: 'no-ai' }

/**
 * Cụm từ (phrasal verb, thành ngữ, collocation) và từ loại theo ngữ cảnh của từ đơn trong các câu, do AI chọn;
 * nhiều câu thì chia phần gọi song song. Kết quả cache trong bảng lookups theo `key`.
 * Chỉ gọi AI khi `generate`, còn lại chỉ trả kết quả đã cache.
 * Bỏ cụm AI báo sai câu; surface không khớp nguyên văn thì để rỗng (không luyện gõ được).
 */
export async function findPhrases(key: string, segs: Array<{ idx: number; text: string }>, generate: boolean): Promise<PhrasesResult> {
  let result: VideoPhrases | null = null
  const cached = db.select().from(lookups).where(eq(lookups.key, key)).get()
  if (cached) {
    const parsed = VideoPhrasesSchema.safeParse(JSON.parse(cached.json))
    if (parsed.success) result = parsed.data
  }
  if (!result) {
    if (!hasLlm(getConfig())) return { status: 'no-ai' }
    if (!generate) return { status: 'idle' }
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
}
