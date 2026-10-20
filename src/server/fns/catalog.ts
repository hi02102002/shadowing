import { createServerFn } from '@tanstack/react-start'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { videos } from '#/db/schema.ts'
import { CATALOG_MAX_PAGE, CATALOG_SOURCES, LEVELS } from '#/lib/levels.ts'
import type { CatalogSource, Level } from '#/lib/levels.ts'
import { youtubeThumbnail } from '#/lib/youtube-id.ts'
import {
  ELLLO_VIEWS_LEVELS,
  fetchEllloBook,
  fetchEllloLevel,
  fetchEllloViews,
} from '../elllo/elllo.ts'
import { searchVideos, watchUrl } from '../youtube/ytdlp.ts'

export type { CatalogSource }

export interface CatalogItem {
  /** link đưa cho importVideo */
  url: string
  title: string
  thumbnail?: string
  durationSec?: number
  channel?: string
  /** số thứ tự bài trên elllo, vd. "Video 50", "Bài 3" */
  label?: string
  /** đã có trong thư viện (chỉ biết trước với YouTube) → mở thẳng bằng khoá này */
  youtubeId?: string
  imported: boolean
}

export interface CatalogPage {
  items: CatalogItem[]
  page: number
  /** chỉ biết với elllo; YouTube tìm kiếm không giới hạn → dùng hasMore */
  totalPages?: number
  hasMore: boolean
}

const PAGE_SIZE = 12

const YT_QUERY: Record<Level, string> = {
  A1: 'A1 English listening practice beginner',
  A2: 'A2 English listening practice elementary',
  B1: 'B1 English listening practice intermediate',
  B2: 'B2 English listening practice upper intermediate',
  C1: 'C1 English listening practice advanced',
}

type Item = Omit<CatalogItem, 'imported'>
type Page = Omit<CatalogPage, 'items'> & { items: Item[] }

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; value: unknown }>()

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T
  const value = await load()
  cache.set(key, { at: Date.now(), value })
  return value
}

/** danh sách elllo nằm gọn trong một trang mục lục → tải một lần rồi cắt trang */
function paginate(all: Item[], page: number): Page {
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
  return {
    items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    page,
    totalPages,
    hasMore: page < totalPages,
  }
}

const ellloPage = async (level: Level, page: number) =>
  paginate(
    await cached(`elllo:${level}`, async () =>
      (await fetchEllloLevel(level)).map((l): Item => ({
        url: l.url,
        title: l.title,
        thumbnail: l.thumbnail,
        channel: 'ELLLO',
        label: `Video ${l.number}`,
      })),
    ),
    page,
  )

const ellloBookPage = async (level: Level, page: number) => {
  // một trang mục lục chứa cả 5 cấp độ
  const book = await cached('elllo-book', fetchEllloBook)
  return paginate(
    book
      .filter((l) => l.level === level)
      .map((l) => ({
        url: l.url,
        title: l.title,
        channel: 'ELLLO Grammar',
        label: `Bài ${l.number}`,
      })),
    page,
  )
}

const ellloViewsPage = async (level: Level, page: number) => {
  // elllo không có trang hội thoại cho A1
  const viewsLevel = ELLLO_VIEWS_LEVELS.find((l) => l === level)
  if (!viewsLevel) return paginate([], page)
  return paginate(
    await cached(`elllo-views:${level}`, async () =>
      (await fetchEllloViews(viewsLevel)).map((l): Item => ({
        url: l.url,
        title: l.title,
        thumbnail: l.thumbnail,
        channel: 'ELLLO',
        label: `#${l.number}`,
      })),
    ),
    page,
  )
}

async function youtubePage(level: Level, page: number): Promise<Page> {
  const entries = await cached(`youtube:${level}:${page}`, () =>
    searchVideos(YT_QUERY[level], (page - 1) * PAGE_SIZE + 1, page * PAGE_SIZE),
  )
  return {
    items: entries
      // bỏ livestream (không có thời lượng) và Shorts
      .filter((e) => e.duration && e.duration >= 60)
      .map((e) => ({
        url: watchUrl(e.id),
        title: e.title,
        thumbnail: youtubeThumbnail(e.id),
        durationSec: Math.round(e.duration!),
        channel: e.channel,
        youtubeId: e.id,
      })),
    page,
    hasMore: entries.length === PAGE_SIZE && page < CATALOG_MAX_PAGE,
  }
}

export const listCatalog = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      source: z.enum(CATALOG_SOURCES),
      level: z.enum(LEVELS),
      page: z.number().int().min(1).max(CATALOG_MAX_PAGE),
    }),
  )
  .handler(async ({ data }): Promise<CatalogPage> => {
    const load = {
      elllo: ellloPage,
      'elllo-views': ellloViewsPage,
      'elllo-book': ellloBookPage,
      youtube: youtubePage,
    }[data.source]
    const res = await load(data.level, data.page)
    const ids = res.items.flatMap((i) => (i.youtubeId ? [i.youtubeId] : []))
    const owned = new Set(
      ids.length
        ? db
            .select({ id: videos.youtubeId })
            .from(videos)
            .where(inArray(videos.youtubeId, ids))
            .all()
            .map((r) => r.id)
        : [],
    )
    return {
      ...res,
      items: res.items.map((i) => ({
        ...i,
        imported: !!i.youtubeId && owned.has(i.youtubeId),
      })),
    }
  })
