import type { ListeningLibraryItem, ListeningSource } from '#/lib/listening.ts'
import {
  cambridgeListeningCatalog,
  fetchCambridgeListening,
} from './cambridge-listening.ts'
import { tacticsCatalog, fetchTactics } from './tactics.ts'
import {
  breakingNewsListeningCatalog,
  isBreakingNewsUrl,
  parseBreakingNewsListening,
} from './breaking-news.ts'
import {
  EE_BLOG_API,
  EE_BLOG_BASE,
  parseEeBlogArticle,
  parseEeBlogList,
} from './ee-blog.ts'
import {
  ELLLO_LEVEL_DIR,
  fetchEllloLevel,
  fetchEllloListening,
} from '../elllo/elllo.ts'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<
  ListeningSource,
  { at: number; items: ListeningLibraryItem[] }
>()

async function get(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok)
    throw new Error(`Không mở được ${new URL(url).host} (HTTP ${res.status})`)
  return res
}

const getText = async (url: string) => (await get(url)).text()

async function eeBlogCatalog() {
  const res = await fetch(EE_BLOG_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      languageId: 1,
      inPublished: '1',
      begin: 1,
      end: 200,
      onPage: 'home page',
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok)
    throw new Error(`Không mở được English Blog (HTTP ${res.status})`)
  const json = await res.json()
  return parseEeBlogList(json)
}

async function ellloCatalog(): Promise<ListeningLibraryItem[]> {
  return (
    await Promise.all(
      (Object.keys(ELLLO_LEVEL_DIR) as Array<keyof typeof ELLLO_LEVEL_DIR>).map(
        async (level) =>
          (await fetchEllloLevel(level)).map((item) => ({
            source: 'elllo' as const,
            url: item.url,
            title: item.title,
            levels: [level],
            levelLabel: `ELLLO · ${level}`,
          })),
      ),
    )
  ).flat()
}

const LOADERS: Record<ListeningSource, () => Promise<ListeningLibraryItem[]>> =
  {
    'cambridge-listening': cambridgeListeningCatalog,
    tactics: tacticsCatalog,
    'breaking-news': () => breakingNewsListeningCatalog(getText),
    'ee-blog': eeBlogCatalog,
    elllo: ellloCatalog,
  }

export async function listeningCatalog(source: ListeningSource) {
  const hit = cache.get(source)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items
  const items = await LOADERS[source]()
  if (!items.length)
    throw new Error(
      'Không đọc được mục lục bài nghe, có thể trang nguồn đã đổi cấu trúc',
    )
  cache.set(source, { at: Date.now(), items })
  return items
}

export async function fetchListeningArticle(
  source: ListeningSource,
  url: string,
) {
  if (source === 'cambridge-listening') return fetchCambridgeListening(url)
  if (source === 'tactics') return fetchTactics(url)
  if (source === 'breaking-news') {
    if (!isBreakingNewsUrl(url))
      throw new Error('Link không thuộc Breaking News English')
    return parseBreakingNewsListening(await getText(url), url)
  }
  if (source === 'ee-blog') {
    if (!url.startsWith(EE_BLOG_BASE))
      throw new Error('Link không thuộc English Blog')
    return parseEeBlogArticle(await getText(url), url)
  }
  if (
    !url.startsWith('https://elllo.org/') &&
    !url.startsWith('https://www.elllo.org/')
  )
    throw new Error('Link không thuộc ELLLO')
  return fetchEllloListening(url)
}
