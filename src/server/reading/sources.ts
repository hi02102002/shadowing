/** Thư viện bài đọc chia cấp độ từ các nguồn ngoài: mục lục (cache 6 giờ) và tải một bài */
import type { ReadingQuestion } from '#/db/schema.ts'
import type { LibrarySource, ReadingLevel } from '#/lib/reading-topics.ts'
import { BNE_BASE, bneCatalog, parseBneArticle } from './breaking-news.ts'
import { IELTS_BASE, IELTS_BOOKS, ieltsArticle, ieltsCatalog, ieltsDataUrl, parseIeltsData, parseIeltsUrl } from './cambridge-ielts.ts'
import { EE_READING_BOOKS, EE_SITE, parseEssentialBook, parseEssentialUnit } from './essential.ts'
import { LINGUAPRESS_BASE, LINGUAPRESS_INDEXES, linguapressCatalog, parseLinguapressArticle, parseLinguapressIndex } from './linguapress.ts'
import { ONESTOP_RAW, ONESTOP_TREE, decodeOnestop, parseOnestopText, parseOnestopTree } from './onestop.ts'

export interface LibraryItem {
  source: LibrarySource
  /** trang (hoặc file) gốc của bài, cũng là khoá để biết bài đã mở chưa */
  url: string
  title: string
  /** các cấp CEFR bài thuộc về, để lọc */
  levels: ReadingLevel[]
  /** cấp độ theo cách gọi của nguồn, vd. "Level 4 · B1–B2" */
  levelLabel: string
  /** ngày đăng YYYY-MM-DD nếu nguồn có */
  date?: string
}

export interface LibraryArticle {
  title: string
  paragraphs: string[]
  /** câu hỏi gốc kèm đáp án nếu nguồn có (không có thì AI soạn) */
  questions?: ReadingQuestion[]
}

const BASES: Record<LibrarySource, string> = {
  essential: `${EE_SITE}book/`,
  'cambridge-ielts': IELTS_BASE,
  'breaking-news': BNE_BASE,
  onestop: ONESTOP_RAW,
  linguapress: LINGUAPRESS_BASE,
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Không mở được ${new URL(url).host} (HTTP ${res.status})`)
  return res
}

const getText = async (url: string) => (await get(url)).text()

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<LibrarySource, { at: number; items: LibraryItem[] }>()

/** data.json của đề IELTS (~320 KB mỗi sách): giữ 6 giờ, dùng cho cả mục lục lẫn mở bài */
const ieltsCache = new Map<number, { at: number; data: Promise<ReturnType<typeof parseIeltsData>> }>()
function ieltsData(book: number) {
  const hit = ieltsCache.get(book)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
  const data = getText(ieltsDataUrl(book)).then(parseIeltsData)
  // lỗi mạng thì lần sau tải lại
  data.catch(() => ieltsCache.delete(book))
  ieltsCache.set(book, { at: Date.now(), data })
  return data
}

const LOADERS: Record<LibrarySource, () => Promise<LibraryItem[]>> = {
  'cambridge-ielts': async () => (await Promise.all(IELTS_BOOKS.map(async (b) => ieltsCatalog(b, await ieltsData(b))))).flat(),
  essential: async () => (await Promise.all(EE_READING_BOOKS.map(async (b) => parseEssentialBook(await getText(`${EE_SITE}${b.slug}`), b)))).flat(),
  'breaking-news': () => bneCatalog(getText),
  // API không cần đăng nhập giới hạn 60 lượt/giờ, cache đủ dùng
  onestop: async () => parseOnestopTree((await (await get(ONESTOP_TREE)).json()) as Parameters<typeof parseOnestopTree>[0]),
  linguapress: async () =>
    linguapressCatalog(await Promise.all(LINGUAPRESS_INDEXES.map(async (u) => parseLinguapressIndex(await getText(u), u)))),
}

export async function libraryCatalog(source: LibrarySource): Promise<LibraryItem[]> {
  const hit = cache.get(source)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items
  const items = await LOADERS[source]()
  if (!items.length) throw new Error('Không đọc được mục lục bài đọc, có thể trang nguồn đã đổi cấu trúc')
  cache.set(source, { at: Date.now(), items })
  return items
}

/** chỉ tải link thuộc đúng nguồn (link do client gửi lên) */
export async function fetchLibraryArticle(source: LibrarySource, url: string): Promise<LibraryArticle> {
  if (!url.startsWith(BASES[source])) throw new Error('Link bài đọc không thuộc nguồn này')
  if (source === 'cambridge-ielts') {
    const { book, test, passage } = parseIeltsUrl(url)
    return ieltsArticle(await ieltsData(book), test, passage)
  }
  if (source === 'onestop') return parseOnestopText(decodeOnestop(await (await get(url)).arrayBuffer()), url)
  const html = await getText(url)
  if (source === 'essential') return parseEssentialUnit(html)
  return source === 'breaking-news' ? parseBneArticle(html) : parseLinguapressArticle(html)
}
