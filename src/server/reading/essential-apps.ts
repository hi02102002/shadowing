/** Tải data.json của các app trên essentialenglish.review, cache 6 giờ và chịu được file trộn cp1252. */
import { EE_SITE } from './essential.ts'

export interface EssentialAppData {
  flashcard: Array<Record<string, unknown> & { en?: string; reading?: unknown }>
}

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: Promise<EssentialAppData> }>()

export const essentialDataUrl = (slug: string) =>
  `${EE_SITE}apps-data/${slug}/data/data.json`

export function decodeEssentialData(bytes: ArrayBuffer): EssentialAppData {
  const parse = (encoding: 'utf-8' | 'windows-1252') =>
    JSON.parse(
      new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, ''),
    ) as EssentialAppData
  try {
    return parse('utf-8')
  } catch {
    return parse('windows-1252')
  }
}

export function loadEssentialApp(slug: string) {
  const hit = cache.get(slug)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
  const data = fetch(essentialDataUrl(slug), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(30_000),
  }).then(async (res) => {
    if (!res.ok)
      throw new Error(
        `Không mở được essentialenglish.review (HTTP ${res.status})`,
      )
    return decodeEssentialData(await res.arrayBuffer())
  })
  data.catch(() => cache.delete(slug))
  cache.set(slug, { at: Date.now(), data })
  return data
}
