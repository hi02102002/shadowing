import { createServerFn } from '@tanstack/react-start'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { dictationAttempts, pronunciationAttempts, segments, videos } from '#/db/schema.ts'
import { parseVideoSource, vimeoKey } from '#/lib/video-source.ts'
import { youtubeThumbnail } from '#/lib/youtube-id.ts'
import { fetchEllloLesson } from '../elllo/elllo.ts'
import { parseJson3 } from '../transcript/json3.ts'
import { segmentWords } from '../transcript/segment.ts'
import type { SentenceSegment } from '../transcript/segment.ts'
import { vttToJson3 } from '../transcript/vtt.ts'
import { downloadCaptions, downloadVtt, fetchInfo, fetchUrlInfo, pickCaptionTrack, vttTrackUrls } from '../youtube/ytdlp.ts'

export const listVideos = createServerFn({ method: 'GET' }).handler(async () => {
  const segCount = db
    .select({ videoId: segments.videoId, n: sql<number>`count(*)`.as('n') })
    .from(segments)
    .groupBy(segments.videoId)
    .as('seg_count')

  // số câu đã luyện (có ít nhất 1 lần dictation hoặc phát âm)
  const practiced = db
    .select({
      videoId: segments.videoId,
      n: sql<number>`count(distinct ${segments.id})`.as('practiced_n'),
    })
    .from(segments)
    .where(
      sql`exists (select 1 from ${dictationAttempts} where ${dictationAttempts.segmentId} = ${segments.id})
        or exists (select 1 from ${pronunciationAttempts} where ${pronunciationAttempts.segmentId} = ${segments.id})`,
    )
    .groupBy(segments.videoId)
    .as('practiced')

  return db
    .select({
      id: videos.id,
      youtubeId: videos.youtubeId,
      title: videos.title,
      channel: videos.channel,
      durationSec: videos.durationSec,
      thumbnail: videos.thumbnail,
      captionSource: videos.captionSource,
      createdAt: videos.createdAt,
      segmentCount: sql<number>`coalesce(${segCount.n}, 0)`,
      practicedCount: sql<number>`coalesce(${practiced.n}, 0)`,
    })
    .from(videos)
    .leftJoin(segCount, eq(segCount.videoId, videos.id))
    .leftJoin(practiced, eq(practiced.videoId, videos.id))
    .orderBy(desc(videos.createdAt))
    .all()
})

export type VideoListItem = Awaited<ReturnType<typeof listVideos>>[number]

export const getVideo = createServerFn({ method: 'GET' })
  .validator(z.object({ youtubeId: z.string() }))
  .handler(async ({ data }) => {
    const video = db.select().from(videos).where(eq(videos.youtubeId, data.youtubeId)).get()
    if (!video) throw new Error('Không tìm thấy video')

    const segs = db
      .select()
      .from(segments)
      .where(eq(segments.videoId, video.id))
      .orderBy(asc(segments.idx))
      .all()

    // điểm tốt nhất mỗi câu để hiển thị tiến độ trên transcript
    const dict = db
      .select({ segmentId: dictationAttempts.segmentId, best: sql<number>`max(${dictationAttempts.score})` })
      .from(dictationAttempts)
      .innerJoin(segments, eq(segments.id, dictationAttempts.segmentId))
      .where(eq(segments.videoId, video.id))
      .groupBy(dictationAttempts.segmentId)
      .all()
    const pron = db
      .select({
        segmentId: pronunciationAttempts.segmentId,
        best: sql<number>`max(${pronunciationAttempts.accuracy})`,
      })
      .from(pronunciationAttempts)
      .innerJoin(segments, eq(segments.id, pronunciationAttempts.segmentId))
      .where(eq(segments.videoId, video.id))
      .groupBy(pronunciationAttempts.segmentId)
      .all()
    const dictBest = new Map(dict.map((d) => [d.segmentId, d.best]))
    const pronBest = new Map(pron.map((d) => [d.segmentId, d.best]))

    return {
      video,
      segments: segs.map((s) => ({
        id: s.id,
        idx: s.idx,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
        words: JSON.parse(s.wordsJson) as Array<{ w: string; s: number; e: number }>,
        dictationBest: dictBest.get(s.id) ?? null,
        pronunciationBest: pronBest.get(s.id) ?? null,
      })),
    }
  })

export type VideoDetail = Awaited<ReturnType<typeof getVideo>>
export type SegmentView = VideoDetail['segments'][number]

export const importVideo = createServerFn({ method: 'POST' })
  .validator(z.object({ url: z.string().min(1) }))
  .handler(async ({ data }) => {
    const source = parseVideoSource(data.url)
    if (!source) throw new Error('Link không hợp lệ. Hãy dán link YouTube hoặc bài video trên elllo.org')
    return source.kind === 'youtube' ? importYouTube(source.id) : importElllo(source.url)
  })

async function importYouTube(youtubeId: string) {
  const existing = db.select().from(videos).where(eq(videos.youtubeId, youtubeId)).get()
  if (existing) return { youtubeId, existed: true }

  const info = await fetchInfo(youtubeId)
  const track = pickCaptionTrack(info)

  if (!track) throw new Error('Video này không có phụ đề tiếng Anh. Hãy chọn video khác có phụ đề (CC).')

  const json3 = await downloadCaptions(track.url)
  const { words } = parseJson3(json3)
  // phụ đề thủ công có dấu câu → ngưỡng khoảng lặng cao hơn để không cắt vụn câu
  const sentences = segmentWords(words, track.source === 'manual' ? { pauseMs: 1500 } : {})
  if (!sentences.length) throw new Error('Không tách được câu nào từ phụ đề')

  saveVideo(
    {
      youtubeId,
      title: info.title,
      channel: info.channel ?? null,
      durationSec: info.duration ? Math.round(info.duration) : null,
      thumbnail: info.thumbnail ?? youtubeThumbnail(youtubeId),
      captionSource: track.source,
    },
    sentences,
  )
  return { youtubeId, existed: false }
}

/** Bài elllo.org: video Vimeo nhúng trong trang, phụ đề lấy từ Vimeo */
async function importElllo(pageUrl: string) {
  const lesson = await fetchEllloLesson(pageUrl)
  const youtubeId = vimeoKey(lesson.vimeoId)

  const existing = db.select().from(videos).where(eq(videos.youtubeId, youtubeId)).get()
  if (existing) return { youtubeId, existed: true }

  const info = await fetchUrlInfo(`https://player.vimeo.com/video/${lesson.vimeoId}`, pageUrl)
  const tracks = vttTrackUrls(info)
  if (!tracks) throw new Error('Video elllo này chưa có phụ đề tiếng Anh. Hãy chọn bài khác.')

  const { words } = parseJson3(vttToJson3(await downloadVtt(tracks.urls)))
  // phụ đề Vimeo (kể cả bản tự động) đã có dấu câu
  const sentences = segmentWords(words, { pauseMs: 1500 })
  if (!sentences.length) throw new Error('Không tách được câu nào từ phụ đề')

  saveVideo(
    {
      youtubeId,
      title: lesson.title || info.title,
      channel: 'ELLLO',
      durationSec: info.duration ? Math.round(info.duration) : null,
      thumbnail: info.thumbnail ?? null,
      captionSource: tracks.source,
    },
    sentences,
  )
  return { youtubeId, existed: false }
}

function saveVideo(values: typeof videos.$inferInsert, sentences: SentenceSegment[]) {
  db.transaction((tx) => {
    const video = tx.insert(videos).values(values).returning().get()
    tx.insert(segments)
      .values(
        sentences.map((s, idx) => ({
          videoId: video.id,
          idx,
          startMs: s.startMs,
          endMs: s.endMs,
          text: s.text,
          wordsJson: JSON.stringify(s.words),
        })),
      )
      .run()
  })
}

export const deleteVideo = createServerFn({ method: 'POST' })
  .validator(z.object({ youtubeId: z.string() }))
  .handler(async ({ data }) => {
    db.delete(videos).where(eq(videos.youtubeId, data.youtubeId)).run()
    return { ok: true }
  })
