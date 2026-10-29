/**
 * Câu ví dụ ngắn kèm bản dịch tiếng Việt từ Tatoeba (API công khai, không cần key; API còn gắn nhãn "unstable").
 * Câu theo giấy phép CC BY 2.0 FR → lưu kèm link câu gốc để ghi nguồn khi hiển thị.
 */

const API = 'https://api.tatoeba.org/unstable/sentences'

export interface TatoebaExample {
  en: string
  vi: string
  /** link câu gốc trên tatoeba.org (ghi nguồn theo CC BY) */
  src: string
}

interface RawSentence {
  id: number
  text: string
  is_unapproved?: boolean
  translations?: Array<{ text: string; lang: string; is_unapproved?: boolean } | Array<{ text: string; lang: string }>>
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** câu tiếng Anh 4–12 từ có bản dịch tiếng Việt, câu chứa đúng từ trước, ngắn trước */
export async function tatoebaExamples(word: string, limit = 2): Promise<TatoebaExample[]> {
  const q = word.trim()
  const url = new URL(API)
  url.search = new URLSearchParams({
    lang: 'eng',
    // cụm nhiều từ thì tìm nguyên cụm
    q: q.includes(' ') ? `"${q}"` : q,
    'trans:lang': 'vie',
    word_count: '4-12',
    sort: 'words',
    limit: '20',
  }).toString()
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Tatoeba lỗi (HTTP ${res.status})`)
  const { data } = (await res.json()) as { data?: RawSentence[] }

  const exact = new RegExp(`\\b${escapeRegExp(q)}\\b`, 'i')
  return (data ?? [])
    .filter((s) => !s.is_unapproved)
    .map((s) => ({
      en: s.text,
      vi: s.translations?.flat().find((t) => t.lang === 'vie')?.text,
      src: `https://tatoeba.org/en/sentences/show/${s.id}`,
    }))
    .filter((s): s is TatoebaExample => !!s.vi)
    .sort((a, b) => Number(!exact.test(a.en)) - Number(!exact.test(b.en)))
    .slice(0, limit)
}
