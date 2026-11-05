import { speechMp3 } from '../tts-route.ts'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/** Tải ảnh/audio từ internet để nhúng vào gói .apkg, chỉ từ các nguồn của trình tạo thẻ (URL có thể do client gửi lên) */
/** thẻ do client gửi lên nên chỉ tải media từ các nguồn của chính trình tạo thẻ */
const ALLOWED_HOSTS = [
  /^th\.bing\.com$/,
  /^tse\d*\.mm\.bing\.net$/,
  /^dict\.youdao\.com$/,
  /(^|\.)essentialenglish\.review$/,
]

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
}

export interface Downloaded {
  data: Uint8Array
  ext: string
}

/** Youdao hay từ chối khi nhiều yêu cầu cùng lúc → giới hạn số tải đồng thời theo máy chủ */
function limiter(host: string) {
  const max = host.includes('youdao') ? 3 : 6
  let active = 0
  const queue: Array<() => void> = []
  return async <T>(task: () => Promise<T>): Promise<T> => {
    // hết chỗ thì chờ; người trước xong sẽ chuyển thẳng slot cho mình (không giảm rồi tăng lại → không vượt max)
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve))
    else active++
    try {
      return await task()
    } finally {
      const waiter = queue.shift()
      if (waiter) waiter()
      else active--
    }
  }
}

export function mediaDownloader() {
  const limiters = new Map<string, ReturnType<typeof limiter>>()
  const limiterFor = (host: string) => {
    let l = limiters.get(host)
    if (!l) limiters.set(host, (l = limiter(host)))
    return l
  }
  const cache = new Map<string, Promise<Downloaded | null>>()
  return (url: string, fallbackExt: string) => {
    const key = url.trim()
    let host = ''
    try {
      const u = new URL(key)
      host = u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname : ''
    } catch {
      /* URL không hợp lệ */
    }
    if (!host || !ALLOWED_HOSTS.some((re) => re.test(host)))
      return Promise.resolve(null)
    let p = cache.get(key)
    if (!p) {
      const wantAudio = fallbackExt === 'mp3'
      const attempt = async (): Promise<Downloaded | null> => {
        const res = await fetch(key, {
          headers: {
            'user-agent': UA,
            referer: host.includes('youdao')
              ? 'https://dict.youdao.com/'
              : host.includes('bing')
                ? 'https://www.bing.com/'
                : '',
          },
          signal: AbortSignal.timeout(10_000),
        })
        const type = (res.headers.get('content-type') ?? '').split(';')[0]
        // Youdao khi bị giới hạn tốc độ có thể trả 200 kèm trang lỗi / nội dung rỗng → coi là thất bại để thử lại
        if (!res.ok || (wantAudio && !type.startsWith('audio/'))) return null
        const data = new Uint8Array(await res.arrayBuffer())
        return data.length ? { data, ext: EXT[type] ?? fallbackExt } : null
      }
      p = limiterFor(host)(async () => {
        for (let i = 1; i <= 3; i++) {
          const got = await attempt().catch(() => null)
          if (got) return got
          if (i < 3) await new Promise((r) => setTimeout(r, 600 * i))
        }
        return null
      })
      cache.set(key, p)
    }
    return p
  }
}
export type Download = ReturnType<typeof mediaDownloader>

const speechLimit = limiter('dict.youdao.com')

/**
 * Giọng đọc UK của text để nhúng vào thẻ: dùng chuỗi nguồn có cache của app (/api/tts), nên cụm Youdao không có audio
 * (dictvoice trả "returned null audio" cho nhiều thành ngữ, câu dài) vẫn đọc được qua nguồn dự phòng. null nếu mọi nguồn hỏng.
 */
export const speech = (text: string): Promise<Downloaded | null> =>
  speechLimit(async () => {
    try {
      return { data: new Uint8Array(await speechMp3(text, 'uk')), ext: 'mp3' }
    } catch {
      return null
    }
  })
