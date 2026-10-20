import https from 'node:https'

/**
 * Dịch bằng các endpoint miễn phí của Google Dịch (không cần API key).
 * Không chính thức và bị giới hạn theo IP (HTTP 429) nếu gọi dồn dập → gửi cả lô nhiều câu trong một lần gọi,
 * bị chặn thì thử endpoint khác. Người gọi nên cache kết quả.
 */

/** giữ mỗi lần gọi dưới giới hạn độ dài của Google (~5000 ký tự) */
const MAX_CHUNK_CHARS = 4000

class RateLimited extends Error {}

type Endpoint = (
  lines: string[],
  target: string,
  source: string,
) => Promise<string[]>

/**
 * Gọi bằng node:https thay vì fetch: trong app desktop (Node của Electron), Google nhận ra fetch (undici)
 * và trả 429 ngay từ lần đầu, còn https thường thì không.
 */
function call(
  url: string,
  init: {
    method?: 'GET' | 'POST'
    headers?: Record<string, string>
    body?: string
  } = {},
) {
  return new Promise<unknown>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: init.method ?? 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          ...init.headers,
          ...(init.body
            ? { 'Content-Length': Buffer.byteLength(init.body) }
            : {}),
        },
        timeout: 15_000,
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status !== 200) {
          res.resume()
          reject(
            status === 429
              ? new RateLimited(
                  'Google Dịch đang giới hạn số lần dịch, thử lại sau ít phút',
                )
              : new Error(`Google Dịch lỗi (HTTP ${status})`),
          )
          return
        }
        res.setEncoding('utf8')
        let body = ''
        res.on('data', (chunk: string) => (body += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch {
            reject(new Error('Google Dịch trả về dữ liệu không đọc được'))
          }
        })
        res.on('error', reject)
      },
    )
    req.on('timeout', () =>
      req.destroy(new Error('Google Dịch phản hồi quá lâu')),
    )
    req.on('error', () => reject(new Error('Không kết nối được Google Dịch')))
    if (init.body) req.write(init.body)
    req.end()
  })
}

/** client=gtx: gửi các câu nối bằng xuống dòng, bản dịch giữ nguyên số dòng */
const gtx =
  (host: string): Endpoint =>
  async (lines, target, source) => {
    const data = (await call(
      `https://${host}/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: new URLSearchParams({ q: lines.join('\n') }).toString(),
      },
    )) as [Array<[string, ...unknown[]]> | null, ...unknown[]]
    return (data[0] ?? [])
      .map((part) => part[0])
      .join('')
      .split('\n')
  }

/** client=dict-chrome-ex: mỗi câu một tham số q, trả về mảng bản dịch */
const dictChrome: Endpoint = async (lines, target, source) => {
  const q = lines.map((l) => `q=${encodeURIComponent(l)}`).join('&')
  const data = await call(
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${source}&tl=${target}&${q}`,
  )
  return (data as unknown[]).map((d) =>
    typeof d === 'string' ? d : Array.isArray(d) ? String(d[0]) : '',
  )
}

const ENDPOINTS: Endpoint[] = [
  gtx('translate.googleapis.com'),
  gtx('translate.google.com'),
  dictChrome,
]

async function translateChunk(
  lines: string[],
  target: string,
  source: string,
): Promise<string[]> {
  let lastError: unknown
  for (const endpoint of ENDPOINTS) {
    try {
      const out = (await endpoint(lines, target, source)).map((l) => l.trim())
      // lệch số dòng thì không ghép lại đúng câu được → thử endpoint khác
      if (out.length === lines.length && out.every(Boolean)) return out
      lastError = new Error('Google Dịch trả về bản dịch không khớp số câu')
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Không dịch được')
}

/** Dịch nhiều câu, giữ nguyên thứ tự; chia lô để mỗi lần gọi không quá dài */
export async function googleTranslateLines(
  lines: string[],
  target = 'vi',
  source = 'en',
): Promise<string[]> {
  const chunks: string[][] = [[]]
  let size = 0
  for (const raw of lines) {
    // xuống dòng trong câu sẽ làm lệch số dòng
    const line = raw.replace(/\s+/g, ' ').trim()
    let chunk = chunks[chunks.length - 1]
    if (size + line.length > MAX_CHUNK_CHARS && chunk.length) {
      chunk = []
      chunks.push(chunk)
      size = 0
    }
    chunk.push(line)
    size += line.length + 1
  }
  const out: string[] = []
  for (const chunk of chunks) {
    if (chunk.length) out.push(...(await translateChunk(chunk, target, source)))
  }
  return out
}
