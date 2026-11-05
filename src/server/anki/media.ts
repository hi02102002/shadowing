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

export function mediaDownloader() {
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
      p = (async () => {
        const res = await fetch(key, {
          headers: {
            'user-agent': UA,
            referer: host.includes('youdao')
              ? 'https://dict.youdao.com/'
              : host.includes('bing')
                ? 'https://www.bing.com/'
                : '',
          },
          signal: AbortSignal.timeout(8_000),
        })
        if (!res.ok) return null
        const data = new Uint8Array(await res.arrayBuffer())
        if (!data.length) return null
        return {
          data,
          ext:
            EXT[(res.headers.get('content-type') ?? '').split(';')[0]] ??
            fallbackExt,
        }
      })().catch(() => null)
      cache.set(key, p)
    }
    return p
  }
}
export type Download = ReturnType<typeof mediaDownloader>
