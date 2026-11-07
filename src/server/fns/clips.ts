import { createServerFn } from '@tanstack/react-start'
import { eq, like } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { lookups, segments, videos } from '#/db/schema.ts'
import { clipContext, findPhrase, phraseTokens } from '#/lib/clip-match.ts'
import type { ClipWord } from '#/lib/clip-match.ts'
import { isLocalKey, vimeoIdFromKey } from '#/lib/video-source.ts'
import { parseJson3 } from '../transcript/json3.ts'
import { segmentWords } from '../transcript/segment.ts'
import {
  downloadCaptions,
  fetchInfo,
  pickCaptionTrack,
  searchVideos,
} from '../youtube/ytdlp.ts'

export interface Clip {
  source: 'library' | 'web'
  youtubeId: string
  /** id video trong thư viện (để mở trang luyện) */
  videoId?: number
  /** câu thứ mấy trong video thư viện (`?seg=`) */
  segIdx?: number
  title: string
  channel: string | null
  /** đoạn phát (đã gồm ngữ cảnh) */
  startMs: number
  endMs: number
  /** chỗ nói đúng cụm từ */
  matchStartMs: number
  matchEndMs: number
  sentence: string
  highlight: [number, number]
}

const MAX_LIBRARY = 20
const MAX_PER_VIDEO = 3
const MAX_WEB = 15
const WEB_CANDIDATES = 12
const WEB_CONCURRENCY = 4
const WEB_DEADLINE_MS = 25_000
const MAX_VIDEO_SEC = 60 * 60

const phraseInput = z.object({
  phrase: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine((p) => {
      const n = phraseTokens(p).length
      return n >= 1 && n <= 6
    }, 'Nhập 1-6 từ tiếng Anh'),
})

const isYouTubeKey = (key: string) => !vimeoIdFromKey(key) && !isLocalKey(key)

const cacheKey = (phrase: string) =>
  `clips:web:${phraseTokens(phrase).join(' ')}`

/** lấy tối đa `perVideo` clip mỗi video, xen kẽ giữa các video để nghe nhiều giọng khác nhau */
function spread(clips: Clip[], perVideo: number, max: number): Clip[] {
  const byVideo = new Map<string, Clip[]>()
  for (const c of clips) {
    const list = byVideo.get(c.youtubeId) ?? []
    if (list.length < perVideo) byVideo.set(c.youtubeId, [...list, c])
  }
  const out: Clip[] = []
  const lists = [...byVideo.values()]
  for (let round = 0; out.length < max && lists.some((l) => l[round]); round++)
    for (const l of lists) if (l[round] && out.length < max) out.push(l[round])
  return out
}

/** Clip trong các video YouTube đã nhập vào thư viện: nhanh, không cần mạng */
export const searchLibraryClips = createServerFn({ method: 'GET' })
  .validator(phraseInput)
  .handler(({ data }): Clip[] => {
    const tokens = phraseTokens(data.phrase)
    // lọc thô bằng LIKE theo từ dài nhất, rồi khớp chính xác theo timing từng từ
    const longest = tokens.reduce((a, b) => (b.length > a.length ? b : a))
    const rows = db
      .select({
        idx: segments.idx,
        startMs: segments.startMs,
        endMs: segments.endMs,
        wordsJson: segments.wordsJson,
        videoId: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        channel: videos.channel,
      })
      .from(segments)
      .innerJoin(videos, eq(segments.videoId, videos.id))
      .where(like(segments.text, `%${longest.replace(/[%_]/g, '')}%`))
      .all()

    const clips: Clip[] = []
    for (const r of rows) {
      if (!isYouTubeKey(r.youtubeId)) continue
      let words: ClipWord[]
      try {
        words = JSON.parse(r.wordsJson) as ClipWord[]
      } catch {
        continue
      }
      for (const m of findPhrase(words, data.phrase)) {
        const ctx = clipContext(words, m, {
          startMs: r.startMs,
          endMs: r.endMs,
        })
        clips.push({
          source: 'library',
          youtubeId: r.youtubeId,
          videoId: r.videoId,
          segIdx: r.idx,
          title: r.title,
          channel: r.channel,
          startMs: ctx.startMs,
          endMs: ctx.endMs,
          matchStartMs: m.startMs,
          matchEndMs: m.endMs,
          sentence: ctx.sentence,
          highlight: ctx.highlight,
        })
      }
    }
    return spread(clips, MAX_PER_VIDEO, MAX_LIBRARY)
  })

/** tải phụ đề một video YouTube rồi tìm cụm từ trong đó; lỗi / không có phụ đề tiếng Anh → [] */
async function clipsFromVideo(
  youtubeId: string,
  phrase: string,
  meta: { title: string; channel: string | null },
): Promise<Clip[]> {
  const info = await fetchInfo(youtubeId)
  if (info.duration && info.duration > MAX_VIDEO_SEC) return []
  const track = pickCaptionTrack(info)
  if (!track) return []
  const { words } = parseJson3(await downloadCaptions(track.url))
  const matches = findPhrase(words, phrase)
  if (!matches.length) return []
  const sentences = segmentWords(words)
  return matches.slice(0, MAX_PER_VIDEO).map((m) => {
    const sent = sentences.find(
      (s) => s.startMs <= m.startMs && m.startMs < s.endMs,
    )
    const ctx = clipContext(words, m, sent)
    return {
      source: 'web',
      youtubeId,
      title: info.title || meta.title,
      channel: info.channel ?? meta.channel,
      startMs: ctx.startMs,
      endMs: ctx.endMs,
      matchStartMs: m.startMs,
      matchEndMs: m.endMs,
      sentence: ctx.sentence,
      highlight: ctx.highlight,
    }
  })
}

/**
 * Tìm thêm trên YouTube: yt-dlp chỉ tìm theo tiêu đề nên phải tải phụ đề từng video để biết
 * chỗ cụm từ được nói. Chậm (vài giây mỗi video) nên chạy song song, có hạn giờ và lưu cache.
 */
export const searchWebClips = createServerFn({ method: 'GET' })
  .validator(phraseInput)
  .handler(async ({ data }): Promise<Clip[]> => {
    const key = cacheKey(data.phrase)
    const cached = db
      .select({ json: lookups.json })
      .from(lookups)
      .where(eq(lookups.key, key))
      .get()
    if (cached) return JSON.parse(cached.json) as Clip[]

    const inLibrary = new Set(
      db
        .select({ id: videos.youtubeId })
        .from(videos)
        .all()
        .map((v) => v.id),
    )
    const candidates = (
      await searchVideos(`"${data.phrase}"`, 1, WEB_CANDIDATES)
    ).filter(
      (e) =>
        !inLibrary.has(e.id) && (!e.duration || e.duration <= MAX_VIDEO_SEC),
    )

    const found: Clip[] = []
    const deadline = Date.now() + WEB_DEADLINE_MS
    let next = 0
    /** hết giờ hoặc có video lỗi (mạng, 429…) thì kết quả chưa đầy đủ */
    const run = { incomplete: false }
    const worker = async () => {
      while (next < candidates.length && found.length < MAX_WEB) {
        if (Date.now() > deadline) {
          run.incomplete = true
          return
        }
        const e = candidates[next++]
        const clips = await clipsFromVideo(e.id, data.phrase, {
          title: e.title,
          channel: e.channel ?? null,
        }).catch(() => {
          run.incomplete = true
          return []
        })
        found.push(...clips)
      }
    }
    await Promise.all(Array.from({ length: WEB_CONCURRENCY }, worker))

    const clips = spread(found, MAX_PER_VIDEO, MAX_WEB)
    // chưa có gì mà kết quả lại chưa đầy đủ thì không cache, để lần sau còn thử lại
    if (clips.length || !run.incomplete)
      db.insert(lookups)
        .values({ key, json: JSON.stringify(clips) })
        .onConflictDoNothing()
        .run()
    return clips
  })
