/** Lấy câu đề phản xạ từ bộ câu sẵn và nguồn ngoài (Tatoeba, iTESLj); đề AI soạn nằm ở fns/reflex.ts */
import { bankPrompts } from '#/lib/reflex-bank.ts'
import { REFLEX_LEVELS, sample } from '#/lib/reflex.ts'
import type { ReflexLevel, ReflexMode, ReflexPrompt } from '#/lib/reflex.ts'
import {
  iteslJTopicUrl,
  parseIteslJIndex,
  parseIteslJQuestions,
  ITESLJ_BASE,
} from './iteslj.ts'
import type { IteslJTopic } from './iteslj.ts'
import { parseTatoeba, tatoebaUrl } from './tatoeba.ts'

const CACHE_MS = 6 * 60 * 60 * 1000

async function get(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok)
    throw new Error(`Không mở được ${new URL(url).host} (HTTP ${res.status})`)
  return res
}

function cached<T>(load: (key: string) => Promise<T>) {
  const cache = new Map<string, { at: number; value: T }>()
  return async (key: string) => {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value
    const value = await load(key)
    cache.set(key, { at: Date.now(), value })
    return value
  }
}

/** cấp độ gần nhất trước: B1 → B1, A2, B2, A1, C1 */
export function nearLevels(level: ReflexLevel): ReflexLevel[] {
  const i = REFLEX_LEVELS.indexOf(level)
  return [...REFLEX_LEVELS].sort(
    (a, b) =>
      Math.abs(REFLEX_LEVELS.indexOf(a) - i) -
        Math.abs(REFLEX_LEVELS.indexOf(b) - i) ||
      REFLEX_LEVELS.indexOf(a) - REFLEX_LEVELS.indexOf(b),
  )
}

/** bộ câu sẵn: bốc ở đúng cấp, thiếu thì lấy thêm cấp kề bên */
export function pickBank(mode: ReflexMode, level: ReflexLevel, count: number) {
  const out: ReflexPrompt[] = []
  for (const l of nearLevels(level)) {
    if (out.length >= count) break
    out.push(...sample(bankPrompts(mode, l), count - out.length))
  }
  return out
}

const iteslJIndex = cached(async () => {
  const topics = parseIteslJIndex(await (await get(ITESLJ_BASE)).text())
  if (!topics.length)
    throw new Error(
      'Không đọc được mục lục iTESLj, có thể trang đã đổi cấu trúc',
    )
  return topics
})

const iteslJTopic = cached(async (slug: string) =>
  parseIteslJQuestions(await (await get(iteslJTopicUrl(slug))).text()),
)

export const iteslJTopics = (): Promise<IteslJTopic[]> => iteslJIndex('')

/** câu hỏi iTESLj: theo chủ đề đã chọn, hoặc gom từ vài chủ đề ngẫu nhiên; ưu tiên câu gần cấp độ */
export async function pickIteslJ(
  level: ReflexLevel,
  count: number,
  slug?: string,
): Promise<ReflexPrompt[]> {
  const topics = await iteslJTopics()
  const chosen = slug
    ? topics.filter((t) => t.slug === slug)
    : sample(topics, 4)
  if (!chosen.length) throw new Error('Không có chủ đề này trên iTESLj')
  const pool = (
    await Promise.all(
      chosen.map(async (t) =>
        (await iteslJTopic(t.slug)).map((q) => ({ ...q, topic: t.title })),
      ),
    )
  ).flat()
  const order = nearLevels(level)
  const out: ReflexPrompt[] = []
  for (const l of order.slice(0, 3)) {
    if (out.length >= count) break
    out.push(
      ...sample(
        pool.filter((q) => q.level === l),
        count - out.length,
      ).map((q) => ({
        prompt: q.question,
        promptLang: 'en' as const,
        hint: q.topic,
        attribution: 'iTESLj Conversation Questions · iteslj.org',
      })),
    )
  }
  if (!out.length)
    throw new Error('Chủ đề này không có câu hỏi phù hợp, hãy chọn chủ đề khác')
  return out
}

/** cặp câu Tatoeba theo cấp độ; gọi lại vài lần nếu lọc xong chưa đủ */
export async function pickTatoeba(
  level: ReflexLevel,
  count: number,
): Promise<ReflexPrompt[]> {
  const out: ReflexPrompt[] = []
  const seen = new Set<string>()
  for (let i = 0; i < 3 && out.length < count; i++) {
    const json: unknown = await (
      await get(tatoebaUrl(level, Math.min(100, count * 3)))
    ).json()
    for (const p of parseTatoeba(json, level)) {
      if (seen.has(p.prompt)) continue
      seen.add(p.prompt)
      out.push(p)
    }
  }
  if (!out.length) throw new Error('Tatoeba không trả về câu nào, hãy thử lại')
  return out.slice(0, count)
}
