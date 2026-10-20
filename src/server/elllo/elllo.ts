/** Đọc trang bài nghe elllo.org: video Vimeo nhúng (hoặc file mp3 với bài chỉ có audio) + tiêu đề */
import { createWriteStream } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import https from 'node:https'
import { pipeline } from 'node:stream/promises'

export interface EllloLesson {
  /** bài video; không có thì là bài chỉ có audio (`audioUrl`) */
  vimeoId?: string
  audioUrl?: string
  title: string
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ')

export function parseEllloPage(html: string, pageUrl = 'https://elllo.org/'): EllloLesson | null {
  const vimeoId = /player\.vimeo\.com\/video\/(\d+)/.exec(html)?.[1]
  // audio chính của bài nằm trong thư mục /Audio/ (các mp3 khác là đoạn giải nghĩa từ vựng)
  const audio = /src="([^"]*\/Audio\/[^"]+\.mp3)"/i.exec(html)?.[1]
  if (!vimeoId && !audio) return null
  const title = decode(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return { vimeoId, audioUrl: audio ? new URL(audio, pageUrl).toString() : undefined, title }
}

/**
 * Không dùng fetch: server elllo kết nối chậm (~350ms) mà Node chỉ chờ mỗi địa chỉ IP 250ms
 * khi thử lần lượt IPv6/IPv4 → fetch báo ETIMEDOUT trên mạng không có IPv6.
 */
// được chuyển thẳng cho net.connect, @types/node chưa khai báo trong RequestOptions
const CONNECT_OPTS = { autoSelectFamilyAttemptTimeout: 3000 }

export async function getHtml(url: string): Promise<string> {
  const res = await open(url, 3)
  res.setEncoding('utf8')
  let body = ''
  for await (const chunk of res) body += chunk as string
  return body
}

/** Tải file (mp3 bài nghe) về `dest` */
export async function downloadEllloFile(url: string, dest: string, signal?: AbortSignal) {
  const res = await open(url, 3, signal)
  await pipeline(res, createWriteStream(dest), { signal })
  return dest
}

function open(url: string, redirects: number, signal?: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20_000, signal, ...CONNECT_OPTS },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
          res.resume()
          resolve(open(new URL(res.headers.location, url).toString(), redirects - 1, signal))
          return
        }
        if (status !== 200) {
          res.resume()
          reject(new Error(`Không mở được trang elllo (HTTP ${status})`))
          return
        }
        resolve(res)
      },
    )
    req.on('timeout', () => req.destroy(new Error('Trang elllo phản hồi quá lâu')))
    req.on('error', reject)
  })
}

export async function fetchEllloLesson(url: string): Promise<EllloLesson> {
  const lesson = parseEllloPage(await getHtml(url), url)
  if (!lesson) throw new Error('Trang elllo này không có video hay audio bài nghe.')
  return lesson
}

export interface EllloIndexItem {
  url: string
  title: string
  thumbnail?: string
  number: number
}

/** thư mục mục Videos của elllo theo cấp độ CEFR */
export const ELLLO_LEVEL_DIR = { A1: 'A1BEG', A2: 'A2BEG', B1: 'B1INT', B2: 'B2INT', C1: 'C1ADV' } as const

// HTML viết tay, không đồng nhất: neo vào "Video 50<br /> <a href="bài">Tiêu đề</a>"
// rồi lấy ảnh bìa gần nhất phía trước (bỏ ảnh cờ quốc gia)
const INDEX_ITEM = /Video\s*(\d+)\s*<br\s*\/?>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
const IMG_SRC = /<img\s[^>]*?src="([^"]+)"/g

export function parseEllloIndex(html: string, baseUrl: string): EllloIndexItem[] {
  return [...html.matchAll(INDEX_ITEM)].map((m) => {
    const before = html.slice(Math.max(0, m.index - 600), m.index)
    const img = [...before.matchAll(IMG_SRC)].map((i) => i[1]).filter((src) => !src.includes('/flags/')).at(-1)
    return {
      url: new URL(m[2], baseUrl).toString(),
      thumbnail: img ? new URL(img, baseUrl).toString() : undefined,
      title: decode(m[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(),
      number: Number(m[1]),
    }
  })
}

export async function fetchEllloLevel(level: keyof typeof ELLLO_LEVEL_DIR): Promise<EllloIndexItem[]> {
  const url = `https://elllo.org/video/${ELLLO_LEVEL_DIR[level]}/index.htm`
  return parseEllloIndex(await getHtml(url), url)
}

export interface EllloBookLesson {
  level: keyof typeof ELLLO_LEVEL_DIR
  url: string
  title: string
  number: number
}

// <a href="A1/A1-01-Be-Verbs-Introductions.html"><strong>Be Verbs - Introductions</strong></a>
// (có bài đánh số kiểu "C1-20A-…")
const BOOK_ITEM = /<a href="((A1|A2|B1|B2|C1)\/\2-(\d+)[A-Za-z]?-[^"]+)"[^>]*>([\s\S]*?)<\/a>/g

/** Sách ngữ pháp elllo: mỗi bài là một video Vimeo kèm audio luyện nghe */
export function parseEllloBook(html: string, baseUrl: string): EllloBookLesson[] {
  // trang viết tay: một bài có thể có vài link (link rỗng, link lặp) → gộp theo URL
  const byUrl = new Map<string, EllloBookLesson>()
  for (const m of html.matchAll(BOOK_ITEM)) {
    const url = new URL(m[1], baseUrl).toString()
    const title = decode(m[4].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    const prev = byUrl.get(url)
    if (prev) {
      if (!prev.title) prev.title = title
      continue
    }
    byUrl.set(url, { level: m[2] as EllloBookLesson['level'], url, number: Number(m[3]), title })
  }
  return [...byUrl.values()]
}

export async function fetchEllloBook(): Promise<EllloBookLesson[]> {
  const url = 'https://elllo.org/book/index.html'
  return parseEllloBook(await getHtml(url), url)
}

export interface EllloViewsLesson {
  url: string
  title: string
  thumbnail?: string
  number: number
}

/** cấp độ có trang "Views" (bài hội thoại); elllo không có trang này cho A1 */
export const ELLLO_VIEWS_LEVELS = ['A2', 'B1', 'B2', 'C1'] as const

// 1381 <a href="../../english/1351/T1381-Sarah-Cowgirl.htm">Rodeo Rider</a><br />Being a woman in the rodeo</div>
// (một số bài bọc tên trong <strong>)
const VIEWS_ITEM =
  /(\d{3,4})\s*(?:<strong>\s*)?<a href="([^"]*english\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*(?:<br\s*\/?>)?\s*(?:<\/strong>)?([\s\S]*?)<\/div>/g

export function parseEllloViews(html: string, baseUrl: string): EllloViewsLesson[] {
  const seen = new Set<string>()
  const out: EllloViewsLesson[] = []
  for (const m of html.matchAll(VIEWS_ITEM)) {
    const url = new URL(m[2], baseUrl).toString()
    if (seen.has(url)) continue
    seen.add(url)
    const clean = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    const name = clean(m[3])
    const question = clean(m[4])
    // ảnh bìa gần nhất phía trước (bỏ ảnh cờ quốc gia)
    const before = html.slice(Math.max(0, m.index - 800), m.index)
    const img = [...before.matchAll(IMG_SRC)]
      .map((i) => i[1])
      .filter((src) => !/flag/i.test(src))
      .at(-1)
    out.push({
      url,
      // câu hỏi chủ đề dễ hiểu hơn tên bài ngắn ("Commercial Xmas")
      title: question ? `${question} (${name})` : name,
      thumbnail: img ? new URL(img, baseUrl).toString() : undefined,
      number: Number(m[1]),
    })
  }
  return out
}

export async function fetchEllloViews(level: (typeof ELLLO_VIEWS_LEVELS)[number]): Promise<EllloViewsLesson[]> {
  const url = `https://elllo.org/levels/views/${level}-views.html`
  return parseEllloViews(await getHtml(url), url)
}
