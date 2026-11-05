/**
 * GET /api/essential-media/:slug/:dir/:file — ảnh/audio thẻ từ vựng essentialenglish.review:
 * lần đầu tải từ site rồi lưu DATA_DIR/essential/<slug>/<dir>/<file>.
 * dir '_' = data/wordlist (2nd Edition), '__' = data/ (ảnh bài đọc), còn lại = data/<dir>/wordlist (tên unit đã chuẩn hoá)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineHandler } from 'nitro/h3'

import { EE_BASE, findBook } from './essential/books.ts'
import { essentialDir } from './essential/vocab.ts'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
}

async function fetchMedia(url: URL, file: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !/^(image|audio)\//.test(type)) return null
  const data = Buffer.from(await res.arrayBuffer())
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, data)
  return data
}

/** nội dung ảnh/audio của sách (đọc cache, chưa có thì tải từ site), null nếu tham số sai hoặc không tải được */
export async function getEssentialMedia(slug: string, dir: string, rawName: string) {
  const name = path.basename(rawName)
  if (!findBook(slug) || !/^[\w-]+$/.test(dir) || !/^[\w.-]+\.(jpe?g|png|gif|webp|mp3)$/i.test(name)) return null
  const file = path.join(essentialDir(), slug, dir, name)
  const sub = dir === '__' ? '' : dir === '_' ? 'wordlist/' : `${dir}/wordlist/`
  const url = new URL(`${slug}/data/${sub}${name}`, EE_BASE)
  const data = (await fs.readFile(file).catch(() => null)) ?? (await fetchMedia(url, file).catch(() => null))
  return data ? { data, name } : null
}

export default defineHandler(async (event) => {
  const params = event.context.params ?? {}
  // pattern route bắt buộc đủ 3 tham số
  const media = await getEssentialMedia(params.slug, params.dir, decodeURIComponent(params.file))
  if (!media) return new Response('Not found', { status: 404 })
  const { data, name } = media
  return new Response(data, {
    headers: {
      'content-type': MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'private, max-age=604800',
    },
  })
})
