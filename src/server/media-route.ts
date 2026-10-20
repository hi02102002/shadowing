/**
 * GET /api/media/:key — phục vụ file media đã import, hỗ trợ Range để thẻ <video> tua được.
 *
 * Đăng ký thẳng với Nitro (vite.config.ts) thay vì route TanStack: ở `vite dev`, Nitro coi request có
 * `Sec-Fetch-Dest: video/image` là file tĩnh và trả 404 nếu đường dẫn không khớp một route của Nitro.
 */
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { defineHandler } from 'nitro/h3'

import { db } from '#/db/index.ts'
import { videos } from '#/db/schema.ts'
import { isLocalKey } from '#/lib/video-source.ts'
import { mediaDir, thumbPath } from './media-store.ts'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
}

const notFound = () => new Response('Not found', { status: 404 })

export default defineHandler(async (event) => {
  const request = event.req
  const key = decodeURIComponent(event.context.params?.key ?? '')
  if (!isLocalKey(key)) return notFound()

  if (new URL(request.url).searchParams.has('thumb')) {
    const thumb = await fs.readFile(thumbPath(key)).catch(() => null)
    return thumb
      ? new Response(thumb, {
          headers: {
            'content-type': 'image/jpeg',
            'cache-control': 'private, max-age=86400',
          },
        })
      : notFound()
  }

  const video = db.select().from(videos).where(eq(videos.youtubeId, key)).get()
  if (!video?.mediaPath) return notFound()
  const file = path.join(mediaDir(), path.basename(video.mediaPath))
  const stat = await fs.stat(file).catch(() => null)
  if (!stat) return notFound()

  const headers: Record<string, string> = {
    'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '')
  if (!range) {
    headers['content-length'] = String(stat.size)
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers })
  }

  const size = stat.size
  // "bytes=100-" = từ byte 100 tới hết · "bytes=-500" = 500 byte cuối
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2] || size))
  const end = Math.min(range[1] && range[2] ? Number(range[2]) : size - 1, size - 1)
  if (start > end) {
    return new Response(null, {
      status: 416,
      headers: { 'content-range': `bytes */${size}` },
    })
  }
  headers['content-range'] = `bytes ${start}-${end}/${size}`
  headers['content-length'] = String(end - start + 1)
  return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, {
    status: 206,
    headers,
  })
})
