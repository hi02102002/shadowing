/** GET /api/grammar-media/:file — ảnh minh hoạ sách ngữ pháp: lần đầu tải từ essentialenglish.review rồi lưu DATA_DIR/grammar/images */
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineHandler } from 'nitro/h3'

import { EGIU_BASE, grammarImagesDir } from './grammar/egiu.ts'

const IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

async function fetchImage(name: string, file: string) {
  const res = await fetch(new URL(`data/${encodeURIComponent(name)}`, EGIU_BASE), {
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null
  const data = Buffer.from(await res.arrayBuffer())
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, data)
  return data
}

export default defineHandler(async (event) => {
  const name = path.basename(decodeURIComponent(event.context.params?.file ?? ''))
  if (!/^[\w.-]+\.(jpe?g|png|gif|webp)$/i.test(name)) return new Response('Not found', { status: 404 })
  const file = path.join(grammarImagesDir(), name)
  const data = (await fs.readFile(file).catch(() => null)) ?? (await fetchImage(name, file).catch(() => null))
  if (!data) return new Response('Not found', { status: 404 })
  return new Response(data, {
    headers: {
      'content-type': IMAGE_MIME[path.extname(name).toLowerCase()] ?? 'image/jpeg',
      'cache-control': 'private, max-age=604800',
    },
  })
})
