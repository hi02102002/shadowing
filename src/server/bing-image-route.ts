/**
 * GET /api/bing-image/:q — ảnh minh hoạ cho từ/cụm từ lấy từ ảnh thu nhỏ của Bing Images
 * (kết quả đầu tiên của q, SafeSearch strict). Lần đầu tải rồi lưu DATA_DIR/bing-images/<sha1(q)>.jpg.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineHandler } from 'nitro/h3'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const imagesDir = () => path.join(path.resolve(process.env.DATA_DIR ?? 'data'), 'bing-images')

async function fetchImage(q: string, file: string) {
  const params = new URLSearchParams({
    q,
    c: '7',
    rs: '1',
    p: '0',
    o: '5',
    dpr: '2',
    pid: '1.7',
    mkt: 'en-WW',
    setlang: 'en',
    adlt: 'strict',
    t: '1',
  })
  const res = await fetch(`https://th.bing.com/th?${params}`, {
    headers: { 'user-agent': UA, referer: 'https://www.bing.com/' },
    signal: AbortSignal.timeout(15_000),
  })
  // không có kết quả: Bing trả 404 kèm ảnh giữ chỗ → bỏ
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null
  const data = Buffer.from(await res.arrayBuffer())
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, data)
  return data
}

export default defineHandler(async (event) => {
  const q = decodeURIComponent(event.context.params?.q ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (!q || q.length > 100) return new Response('Not found', { status: 404 })
  const file = path.join(imagesDir(), `${createHash('sha1').update(q).digest('hex')}.jpg`)
  const data = (await fs.readFile(file).catch(() => null)) ?? (await fetchImage(q, file).catch(() => null))
  if (!data) return new Response('Not found', { status: 404 })
  return new Response(data, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=604800' },
  })
})
