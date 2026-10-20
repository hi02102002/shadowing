/**
 * GET /api/tts?text=…&accent=us|uk — giọng đọc mẫu (mp3), lưu cache trong DATA_DIR/tts.
 * Nguồn theo thứ tự: Youdao (có riêng UK/US, đọc được cả câu) → Google Dịch nếu Youdao lỗi.
 *
 * Thay cho speechSynthesis của trình duyệt: Electron trên Linux không có giọng đọc nào nên bấm không ra tiếng.
 * Đăng ký thẳng với Nitro (vite.config.ts) giống /api/media: thẻ <audio> gửi `Sec-Fetch-Dest: audio`.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import https from 'node:https'
import path from 'node:path'
import { defineHandler } from 'nitro/h3'

/** Google chỉ đọc tối đa ~200 ký tự mỗi lần */
const MAX_CHARS = 200
const LANG = { us: 'en-US', uk: 'en-GB' } as const
type Accent = keyof typeof LANG
/** Youdao: type 1 = UK, 2 = US */
const YOUDAO_TYPE = { uk: 1, us: 2 } as const
/** dictvoice không ký chỉ đọc được từ / cụm ngắn (câu dài trả 500) */
const YOUDAO_UNSIGNED_MAX_WORDS = 4

const cacheDir = () => path.resolve(process.env.DATA_DIR ?? 'data', 'tts')

/**
 * Cách ký request của trang web dict.youdao.com (khoá nằm sẵn trong code JS của trang).
 * Không chính thức: Youdao đổi khoá hay cách ký thì hỏng → còn dictvoice không ký và Google phía sau.
 */
const YOUDAO_WEB_KEY = 'U3uACNRWSDWdcsKm'

function youdaoSignedUrl(text: string, accent: Accent) {
  const params: Record<string, string | number> = {
    product: 'webdict',
    appVersion: 1,
    client: 'web',
    mid: 1,
    vendor: 'web',
    screen: 1,
    model: 1,
    imei: 1,
    network: 'wifi',
    keyfrom: 'dick',
    keyid: 'voiceDictWeb',
    mysticTime: Date.now(),
    yduuid: 'abcdefg',
    rate: 4,
    word: text,
    type: YOUDAO_TYPE[accent],
  }
  const keys = Object.keys(params).sort()
  const sign = createHash('md5')
    .update(
      [...keys.map((k) => `${k}=${params[k]}`), `key=${YOUDAO_WEB_KEY}`].join(
        '&',
      ),
    )
    .digest('hex')
  const query = new URLSearchParams({
    ...Object.fromEntries(keys.map((k) => [k, String(params[k])])),
    sign,
    pointParam: [...keys, 'key'].join(','),
  })
  return `https://dict.youdao.com/pronounce/base?${query}`
}

const youdaoUnsignedUrl = (text: string, accent: Accent) =>
  `https://dict.youdao.com/dictvoice?${new URLSearchParams({ audio: text, type: String(YOUDAO_TYPE[accent]) })}`

const googleUrl = (text: string, accent: Accent) =>
  `https://translate.google.com/translate_tts?${new URLSearchParams({ ie: 'UTF-8', client: 'tw-ob', tl: LANG[accent], q: text })}`

async function download(text: string, accent: Accent): Promise<Buffer> {
  const youdao = 'https://dict.youdao.com/'
  const sources: Array<() => Promise<Buffer>> = [
    () => get(youdaoSignedUrl(text, accent), youdao),
    ...(text.split(' ').length <= YOUDAO_UNSIGNED_MAX_WORDS
      ? [() => get(youdaoUnsignedUrl(text, accent), youdao)]
      : []),
    () => get(googleUrl(text, accent)),
  ]
  let lastError: unknown
  for (const source of sources) {
    try {
      return await source()
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

/** node:https thay vì fetch: Google trả 429 cho fetch (undici) chạy trong Electron, xem translate.ts */
function get(url: string, referer?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          ...(referer ? { Referer: referer } : {}),
        },
        timeout: 15_000,
      },
      (res) => {
        if (
          res.statusCode !== 200 ||
          !res.headers['content-type']?.startsWith('audio/')
        ) {
          res.resume()
          reject(new Error(`Không tải được giọng đọc (HTTP ${res.statusCode})`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('Tải giọng đọc quá lâu')))
    req.on('error', reject)
  })
}

export default defineHandler(async (event) => {
  const params = new URL(event.req.url).searchParams
  const text = (params.get('text') ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHARS)
  const accent = params.get('accent') === 'uk' ? 'uk' : 'us'
  if (!text) return new Response('Thiếu text', { status: 400 })

  const lang = LANG[accent]
  const file = path.join(
    cacheDir(),
    `${createHash('sha1').update(`${lang}|${text.toLowerCase()}`).digest('hex')}.mp3`,
  )
  let audio: Buffer | null = await fs.readFile(file).catch(() => null)
  if (!audio) {
    try {
      audio = await download(text, accent)
    } catch (err) {
      return new Response(err instanceof Error ? err.message : String(err), {
        status: 502,
      })
    }
    await fs.mkdir(cacheDir(), { recursive: true })
    await fs.writeFile(file, audio).catch(() => {})
  }
  return new Response(new Uint8Array(audio), {
    headers: {
      'content-type': 'audio/mpeg',
      'content-length': String(audio.length),
      'cache-control': 'private, max-age=604800',
    },
  })
})
