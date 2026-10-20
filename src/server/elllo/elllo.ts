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

function getHtml(url: string, redirects = 3): Promise<string> {
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
