import https from 'node:https'

/**
 * Từ điển Anh–Việt của dunno.ai (API công khai, không cần key, giới hạn ~60 lần/phút theo IP).
 * Không phải API chính thức có cam kết → người gọi nên cache kết quả.
 */

export interface DictSense {
  /** từ loại / lĩnh vực, vd. "ngoại động từ", "kỹ thuật" */
  kind: string
  /** true: nghĩa chuyên ngành (kỹ thuật, xây dựng…) */
  specialized: boolean
  means: string[]
}

export interface DictEntry {
  word: string
  ipaUk: string
  ipaUs: string
  senses: DictSense[]
  synonyms: string[]
  antonyms: string[]
  /** các dạng của động từ: quá khứ, phân từ… */
  forms: string[]
}

interface RawEntry {
  word: string
  keyword?: string | null
  pronounce?: { gb?: string; us?: string } | null
  content?: Array<{
    kind?: string
    field?: string
    means?: Array<{ mean?: string }>
  }> | null
  conjugation?: Record<string, { w?: string } | undefined> | null
  snym?: Array<{
    content?: Array<{ syno?: string[]; anto?: string[] }>
  }> | null
}

function get(url: string) {
  return new Promise<unknown>((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10_000 },
      (res) => {
        const status = res.statusCode ?? 0
        if (status !== 200) {
          res.resume()
          reject(
            new Error(
              status === 429
                ? 'Từ điển đang giới hạn số lần tra, thử lại sau ít phút'
                : `Từ điển lỗi (HTTP ${status})`,
            ),
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
            reject(new Error('Từ điển trả về dữ liệu không đọc được'))
          }
        })
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('Từ điển phản hồi quá lâu')))
    req.on('error', () => reject(new Error('Không kết nối được từ điển')))
  })
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * API tìm theo tiền tố và cả dạng biến đổi ("revealed" → reveal, revealable…):
 * ưu tiên đúng từ, rồi tới mục có dạng biến đổi trùng, cuối cùng lấy mục đầu.
 */
function pick(results: RawEntry[], text: string) {
  const q = norm(text)
  return (
    results.find((r) => norm(r.word) === q) ??
    results.find((r) =>
      (r.keyword ?? '').split(',').some((k) => norm(k) === q),
    ) ??
    results.find((r) =>
      Object.values(r.conjugation ?? {}).some((c) => norm(c?.w ?? '') === q),
    ) ??
    results.at(0)
  )
}

const unique = (list: string[]) => [...new Set(list.filter(Boolean))]

export async function dunnoLookup(text: string): Promise<DictEntry | null> {
  const data = (await get(
    `https://api.dunno.ai/api/search/vi/envi/${encodeURIComponent(text)}?limit=10&page=1`,
  )) as { found?: boolean; result?: RawEntry[] }
  const raw = data.found ? pick(data.result ?? [], text) : undefined
  if (!raw) return null

  const senses = (raw.content ?? [])
    .map((c) => ({
      kind: c.kind ?? '',
      specialized: c.field === 'major',
      means: unique((c.means ?? []).map((m) => m.mean?.trim() ?? '')),
    }))
    .filter((s) => s.means.length > 0)
  const snym = (raw.snym ?? []).flatMap((s) => s.content ?? [])

  return {
    word: raw.word,
    ipaUk: raw.pronounce?.gb ?? '',
    ipaUs: raw.pronounce?.us ?? '',
    // nghĩa thông dụng trước, nghĩa chuyên ngành sau
    senses: [
      ...senses.filter((s) => !s.specialized),
      ...senses.filter((s) => s.specialized),
    ],
    synonyms: unique(snym.flatMap((s) => s.syno ?? [])).slice(0, 8),
    antonyms: unique(snym.flatMap((s) => s.anto ?? [])).slice(0, 5),
    forms: unique(
      Object.values(raw.conjugation ?? {}).map((c) => c?.w ?? ''),
    ).filter((w) => norm(w) !== norm(raw.word)),
  }
}
