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

export default defineHandler(async (event) => {
  const params = event.context.params ?? {}
  // pattern route bắt buộc đủ 3 tham số
  const { slug, dir } = params
  const name = path.basename(decodeURIComponent(params.file))
  if (!findBook(slug) || !/^[\w-]+$/.test(dir) || !/^[\w.-]+\.(jpe?g|png|gif|webp|mp3)$/i.test(name)) {
    return new Response('Not found', { status: 404 })
  }
  const file = path.join(essentialDir(), slug, dir, name)
  const sub = dir === '__' ? '' : dir === '_' ? 'wordlist/' : `${dir}/wordlist/`
  const url = new URL(`${slug}/data/${sub}${name}`, EE_BASE)
  const data = (await fs.readFile(file).catch(() => null)) ?? (await fetchMedia(url, file).catch(() => null))
  if (!data) return new Response('Not found', { status: 404 })
  return new Response(data, {
    headers: {
      'content-type': MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'private, max-age=604800',
    },
  })
})
