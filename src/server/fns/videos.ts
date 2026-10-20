import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createServerFn } from '@tanstack/react-start'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { dictationAttempts, pronunciationAttempts, segments, videos } from '#/db/schema.ts'
import { isLocalKey, localKey, localThumbUrl, parseVideoSource, vimeoKey } from '#/lib/video-source.ts'
import { youtubeThumbnail } from '#/lib/youtube-id.ts'
import { estimateCaptioning, generateCaptionWords, MAX_CAPTION_SEC } from '../captions.ts'
import type { CaptionEstimate } from '../captions.ts'
import { downloadEllloFile, fetchEllloLesson } from '../elllo/elllo.ts'
import { startJob } from '../jobs.ts'
import { makeThumbnail, probeMedia } from '../media.ts'
import type { MediaInfo } from '../media.ts'
import {
  findUpload,
  jobsDir,
  mediaDir,
  moveUploadToMedia,
  removeMedia,
  removeUpload,
  thumbPath,
} from '../media-store.ts'
import { parseJson3 } from '../transcript/json3.ts'
import { playbackBounds, segmentWords } from '../transcript/segment.ts'
import type { SentenceSegment } from '../transcript/segment.ts'
import { subtitleToJson3 } from '../transcript/vtt.ts'
import {
  downloadAudio,
  downloadCaptions,
  downloadVtt,
  fetchInfo,
  fetchUrlInfo,
  pickCaptionTrack,
  vttTrackUrls,
  watchUrl,
} from '../youtube/ytdlp.ts'

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
      // khoảng phát lấn vào khoảng lặng hai bên để không cụt âm đầu/cuối câu
      segments: playbackBounds(segs).map((s) => ({
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

export type ImportResult =
  | { status: 'ready'; youtubeId: string; existed: boolean }
  /** không có phụ đề: client hỏi người dùng có muốn tạo bằng Whisper không (kèm ước tính) */
  | { status: 'needs-captions'; title: string; durationSec: number; estimate: CaptionEstimate }
  /** đang tạo phụ đề nền, hỏi tiến độ bằng captionJobStatus */
  | { status: 'job'; jobId: string }

export const importVideo = createServerFn({ method: 'POST' })
  .validator(z.object({ url: z.string().min(1), generateCaptions: z.boolean().optional() }))
  .handler(async ({ data }): Promise<ImportResult> => {
    const source = parseVideoSource(data.url)
    if (!source) throw new Error('Link không hợp lệ. Hãy dán link YouTube hoặc bài video trên elllo.org')
    const generate = data.generateCaptions ?? false
    return source.kind === 'youtube' ? importYouTube(source.id, generate) : importElllo(source.url, generate)
  })

async function importYouTube(youtubeId: string, generate: boolean): Promise<ImportResult> {
  const existing = db.select().from(videos).where(eq(videos.youtubeId, youtubeId)).get()
  if (existing) return { status: 'ready', youtubeId, existed: true }

  const info = await fetchInfo(youtubeId)
  const values = {
    youtubeId,
    title: info.title,
    channel: info.channel ?? null,
    durationSec: info.duration ? Math.round(info.duration) : null,
    thumbnail: info.thumbnail ?? youtubeThumbnail(youtubeId),
  }
  const track = pickCaptionTrack(info)

  if (!track) {
    return captionFromAudio(values, generate, (dir, signal) => downloadAudio(watchUrl(youtubeId), dir, { signal }))
  }

  const json3 = await downloadCaptions(track.url)
  const { words } = parseJson3(json3)
  // phụ đề thủ công có dấu câu → ngưỡng khoảng lặng cao hơn để không cắt vụn câu
  const sentences = segmentWords(words, track.source === 'manual' ? { pauseMs: 1500 } : {})
  if (!sentences.length) throw new Error('Không tách được câu nào từ phụ đề')

  saveVideo({ ...values, captionSource: track.source }, sentences)
  return { status: 'ready', youtubeId, existed: false }
}

/** Bài elllo.org: video Vimeo nhúng trong trang, phụ đề lấy từ Vimeo */
async function importElllo(pageUrl: string, generate: boolean): Promise<ImportResult> {
  const lesson = await fetchEllloLesson(pageUrl)
  if (!lesson.vimeoId) return importEllloAudio(lesson.audioUrl!, lesson.title, generate)
  const youtubeId = vimeoKey(lesson.vimeoId)

  const existing = db.select().from(videos).where(eq(videos.youtubeId, youtubeId)).get()
  if (existing) return { status: 'ready', youtubeId, existed: true }

  const playerUrl = `https://player.vimeo.com/video/${lesson.vimeoId}`
  const info = await fetchUrlInfo(playerUrl, pageUrl)
  const values = {
    youtubeId,
    title: lesson.title || info.title,
    channel: 'ELLLO',
    durationSec: info.duration ? Math.round(info.duration) : null,
    thumbnail: info.thumbnail ?? null,
  }
  const tracks = vttTrackUrls(info)

  if (!tracks) {
    return captionFromAudio(values, generate, (dir, signal) =>
      downloadAudio(playerUrl, dir, { referer: pageUrl, signal }),
    )
  }

  const { words } = parseJson3(subtitleToJson3(await downloadVtt(tracks.urls)))
  // phụ đề Vimeo (kể cả bản tự động) đã có dấu câu
  const sentences = segmentWords(words, { pauseMs: 1500 })
  if (!sentences.length) throw new Error('Không tách được câu nào từ phụ đề')

  saveVideo({ ...values, captionSource: tracks.source }, sentences)
  return { status: 'ready', youtubeId, existed: false }
}

type VideoValues = Omit<typeof videos.$inferInsert, 'captionSource'>

/**
 * Video online không có phụ đề: lần đầu trả ước tính để client hỏi lại người dùng,
 * khi được đồng ý thì tải audio và tạo phụ đề bằng Whisper trong một job nền.
 */
/**
 * Bài elllo chỉ có audio (mục hội thoại "Views"): tải mp3 về làm media trên máy, tạo phụ đề bằng Whisper.
 * Khoá tính từ link mp3 nên import lại cùng bài không bị trùng.
 */
async function importEllloAudio(audioUrl: string, title: string, generate: boolean): Promise<ImportResult> {
  const youtubeId = localKey(`elllo-${createHash('sha1').update(audioUrl).digest('hex').slice(0, 16)}`)
  const existing = db.select().from(videos).where(eq(videos.youtubeId, youtubeId)).get()
  if (existing) return { status: 'ready', youtubeId, existed: true }

  // ffmpeg đọc thẳng từ link nên không phải tải cả file chỉ để biết thời lượng
  const { durationSec } = await probeMedia(audioUrl)
  return captionFromAudio(
    { youtubeId, title, channel: 'ELLLO', durationSec: Math.round(durationSec), thumbnail: null },
    generate,
    async (dir, signal) => {
      await fs.mkdir(dir, { recursive: true })
      return downloadEllloFile(audioUrl, path.join(dir, `audio${path.extname(new URL(audioUrl).pathname)}`), signal)
    },
    { keepAudio: true },
  )
}

function captionFromAudio(
  values: VideoValues,
  generate: boolean,
  fetchAudio: (dir: string, signal: AbortSignal) => Promise<string>,
  /** keepAudio: file audio tải về chính là media của bài (phát bằng LocalPlayer) */
  opts: { keepAudio?: boolean } = {},
): ImportResult {
  const durationSec = values.durationSec ?? 0
  if (durationSec > MAX_CAPTION_SEC) {
    throw new Error('Video không có phụ đề và dài hơn 3 giờ, không tạo phụ đề tự động được.')
  }
  if (!generate) {
    return { status: 'needs-captions', title: values.title, durationSec, estimate: estimateCaptioning(durationSec) }
  }

  const workDir = path.join(jobsDir(), randomUUID())
  const jobId = startJob(
    values.title,
    async ({ signal, report }) => {
      report({ stage: 'downloading-audio', progress: 0 })
      const audio = await fetchAudio(workDir, signal)
      const { durationSec: realSec } = await probeMedia(audio)
      const words = await generateCaptionWords(audio, { durationSec: realSec, workDir, signal, onProgress: report })
      const sentences = segmentWords(words, { pauseMs: 1500 })
      if (!sentences.length) throw new Error('Whisper không nhận ra lời nói nào trong video')
      signal.throwIfAborted()
      // người dùng có thể đã import cùng video trong lúc chờ
      if (!db.select().from(videos).where(eq(videos.youtubeId, values.youtubeId)).get()) {
        const mediaPath = opts.keepAudio ? await moveUploadToMedia(audio, values.youtubeId) : values.mediaPath
        saveVideo(
          { ...values, mediaPath, durationSec: values.durationSec ?? Math.round(realSec), captionSource: 'whisper' },
          sentences,
        )
      }
      return { youtubeId: values.youtubeId }
    },
    () => fs.rm(workDir, { recursive: true, force: true }),
  )
  return { status: 'job', jobId }
}

export const importLocal = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      uploadId: z.string().min(1),
      title: z.string().trim().min(1).max(300),
      /** nội dung file .srt/.vtt (client đọc sẵn) */
      subtitle: z.string().max(5 * 1024 * 1024).optional(),
      generateCaptions: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }): Promise<ImportResult> => {
    const upload = await findUpload(data.uploadId)
    if (!upload) throw new Error('File tải lên đã hết hạn, hãy chọn lại file.')

    let media: MediaInfo
    try {
      media = await probeMedia(upload)
    } catch (err) {
      await fs.rm(upload, { force: true })
      throw err
    }

    const youtubeId = localKey(randomUUID())
    const values: VideoValues = {
      youtubeId,
      title: data.title,
      channel: 'File trên máy',
      durationSec: Math.round(media.durationSec),
      thumbnail: media.hasVideo ? localThumbUrl(youtubeId) : null,
    }

    /** chuyển file vào thư mục media, tạo thumbnail rồi lưu video */
    const finish = async (sentences: SentenceSegment[], captionSource: 'file' | 'whisper') => {
      const mediaPath = await moveUploadToMedia(upload, youtubeId)
      if (media.hasVideo) {
        await makeThumbnail(path.join(mediaDir(), mediaPath), thumbPath(youtubeId), media.durationSec).catch((err) => {
          console.warn('[thumbnail]', err)
          values.thumbnail = null
        })
      }
      saveVideo({ ...values, mediaPath, captionSource }, sentences)
    }

    if (data.subtitle?.trim()) {
      const { words } = parseJson3(subtitleToJson3(data.subtitle))
      const sentences = segmentWords(words, { pauseMs: 1500 })
      if (!sentences.length) throw new Error('Không đọc được phụ đề. Hãy chọn file .srt hoặc .vtt hợp lệ.')
      await finish(sentences, 'file')
      return { status: 'ready', youtubeId, existed: false }
    }

    if (media.durationSec > MAX_CAPTION_SEC) {
      throw new Error('File dài hơn 3 giờ, không tạo phụ đề tự động được. Hãy chọn kèm file phụ đề.')
    }
    if (!data.generateCaptions) {
      return {
        status: 'needs-captions',
        title: data.title,
        durationSec: media.durationSec,
        estimate: estimateCaptioning(media.durationSec),
      }
    }

    const workDir = path.join(jobsDir(), randomUUID())
    const jobId = startJob(
      data.title,
      async ({ signal, report }) => {
        const words = await generateCaptionWords(upload, {
          durationSec: media.durationSec,
          workDir,
          signal,
          onProgress: report,
        })
        const sentences = segmentWords(words, { pauseMs: 1500 })
        if (!sentences.length) throw new Error('Whisper không nhận ra lời nói nào trong file')
        signal.throwIfAborted()
        await finish(sentences, 'whisper')
        return { youtubeId }
      },
      async () => {
        await fs.rm(workDir, { recursive: true, force: true })
        // job lỗi/bị huỷ: file upload không còn dùng được nữa (thành công thì đã được chuyển đi)
        await fs.rm(upload, { force: true })
      },
    )
    return { status: 'job', jobId }
  })

/** Người dùng bỏ qua bước tạo phụ đề → xoá file đã upload */
export const discardUpload = createServerFn({ method: 'POST' })
  .validator(z.object({ uploadId: z.string() }))
  .handler(async ({ data }) => {
    await removeUpload(data.uploadId)
    return { ok: true }
  })

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
    const video = db.select().from(videos).where(eq(videos.youtubeId, data.youtubeId)).get()
    db.delete(videos).where(eq(videos.youtubeId, data.youtubeId)).run()
    if (video && isLocalKey(video.youtubeId)) await removeMedia(video.youtubeId, video.mediaPath)
    return { ok: true }
  })
