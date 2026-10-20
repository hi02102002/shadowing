/** Đọc trang bài nghe elllo.org: video Vimeo nhúng + tiêu đề */
import https from 'node:https'

export interface EllloLesson {
  vimeoId: string
  title: string
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ')

export function parseEllloPage(html: string): EllloLesson | null {
  const vimeoId = /player\.vimeo\.com\/video\/(\d+)/.exec(html)?.[1]
  if (!vimeoId) return null
  const title = decode(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return { vimeoId, title }
}

/**
 * Không dùng fetch: server elllo kết nối chậm (~350ms) mà Node chỉ chờ mỗi địa chỉ IP 250ms
 * khi thử lần lượt IPv6/IPv4 → fetch báo ETIMEDOUT trên mạng không có IPv6.
 */
// được chuyển thẳng cho net.connect, @types/node chưa khai báo trong RequestOptions
const CONNECT_OPTS = { autoSelectFamilyAttemptTimeout: 3000 }

export function getHtml(url: string, redirects = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20_000, ...CONNECT_OPTS },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
          res.resume()
          resolve(getHtml(new URL(res.headers.location, url).toString(), redirects - 1))
          return
        }
        if (status !== 200) {
          res.resume()
          reject(new Error(`Không mở được trang elllo (HTTP ${status})`))
          return
        }
        res.setEncoding('utf8')
        let body = ''
        res.on('data', (chunk: string) => (body += chunk))
        res.on('end', () => resolve(body))
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('Trang elllo phản hồi quá lâu')))
    req.on('error', reject)
  })
}

export async function fetchEllloLesson(url: string): Promise<EllloLesson> {
  const lesson = parseEllloPage(await getHtml(url))
  if (!lesson) throw new Error('Bài elllo này không có video. Hãy chọn bài trong mục Videos của elllo.')
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
