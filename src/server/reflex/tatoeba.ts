/** Cặp câu Việt–Anh từ Tatoeba (api.tatoeba.org) cho dạng "Dịch nói Việt → Anh". Câu theo CC BY 2.0 FR: giữ tác giả từng câu. */
import { LEVEL_WORD_RANGE, wordCount } from '#/lib/reflex.ts'
import type { ReflexLevel, ReflexPrompt } from '#/lib/reflex.ts'

export const TATOEBA_API = 'https://api.tatoeba.org/unstable/sentences'

/** số âm tiết tiếng Việt cần lọc ở API (tiếng Việt thường dài hơn tiếng Anh ~1.3 lần) */
const VIE_WORDS: Record<ReflexLevel, [number, number]> = {
  A1: [2, 6],
  A2: [7, 10],
  B1: [11, 15],
  B2: [16, 23],
  C1: [24, 60],
}

interface TatoebaSentence {
  id: number
  text: string
  license?: string | null
  owner?: string | null
  is_unapproved?: boolean
  translations?: Array<TatoebaSentence & { lang?: string; is_direct?: boolean }>
}

/** lấy nhiều hơn cần để lọc theo độ dài câu tiếng Anh */
export function tatoebaUrl(level: ReflexLevel, limit: number) {
  const [min, max] = VIE_WORDS[level]
  const url = new URL(TATOEBA_API)
  url.searchParams.set('lang', 'vie')
  url.searchParams.set('trans:lang', 'eng')
  url.searchParams.set('sort', 'random')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('word_count', `${min}-${max}`)
  return url.toString()
}

const credit = (s: TatoebaSentence) =>
  `Tatoeba #${s.id}${s.owner ? ` (${s.owner})` : ''} · ${s.license || 'CC BY 2.0 FR'}`

/** JSON của API → câu đề; ưu tiên bản dịch trực tiếp, bỏ câu chưa duyệt và câu tiếng Anh lệch cấp độ quá xa */
export function parseTatoeba(
  json: unknown,
  level: ReflexLevel,
): ReflexPrompt[] {
  const data = (json as { data?: TatoebaSentence[] } | null)?.data ?? []
  const [min, max] = LEVEL_WORD_RANGE[level]
  const out: ReflexPrompt[] = []
  const seen = new Set<string>()
  for (const s of data) {
    if (s.is_unapproved || !s.text.trim()) continue
    const translations = (s.translations ?? []).filter(
      (t) => (t.lang ?? 'eng') === 'eng' && !t.is_unapproved && t.text.trim(),
    )
    const en = translations.find((t) => t.is_direct) ?? translations.at(0)
    if (!en) continue
    const words = wordCount(en.text)
    // nới 2 từ mỗi đầu: độ dài chỉ là ước lượng cấp độ
    if (words < min - 2 || words > max + 2) continue
    if (seen.has(s.text)) continue
    seen.add(s.text)
    out.push({
      prompt: s.text.trim(),
      promptLang: 'vi',
      reference: en.text.trim(),
      attribution: `${credit(s)} → ${credit(en)}`,
    })
  }
  return out
}
