/**
 * GET /api/media/:key — phục vụ file media đã import, hỗ trợ Range để thẻ <video> tua được.
 *
 * Đăng ký thẳng với Nitro (vite.config.ts) thay vì route TanStack: ở `vite dev`, Nitro coi request có
 * `Sec-Fetch-Dest: video/image` là file tĩnh và trả 404 nếu đường dẫn không khớp một route của Nitro.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { defineHandler } from 'nitro/h3'

import { db } from '#/db/index.ts'
import { videos } from '#/db/schema.ts'
import { isLocalKey } from '#/lib/video-source.ts'
import { mediaDir, thumbPath } from './media-store.ts'
import { fileRangeResponse } from './file-range.ts'

export const MIME: Record<string, string> = {
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
  return fileRangeResponse(
    request,
    file,
    MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
  )
})
