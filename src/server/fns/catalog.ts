import { createServerFn } from '@tanstack/react-start'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { videos } from '#/db/schema.ts'
import { CATALOG_MAX_PAGE, LEVELS } from '#/lib/levels.ts'
import type { Level } from '#/lib/levels.ts'
import { youtubeThumbnail } from '#/lib/youtube-id.ts'
import { fetchEllloLevel } from '../elllo/elllo.ts'
import { searchVideos, watchUrl } from '../youtube/ytdlp.ts'

export type CatalogSource = 'elllo' | 'youtube'

export interface CatalogItem {
  /** link đưa cho importVideo */
  url: string
  title: string
  thumbnail?: string
  durationSec?: number
  channel?: string
  /** số thứ tự bài trên elllo */
  number?: number
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

async function ellloPage(level: Level, page: number): Promise<Page> {
  // trang mục lục elllo chứa cả cấp độ (~50 bài) → tải một lần rồi cắt
  const all = await cached(`elllo:${level}`, async () =>
    (await fetchEllloLevel(level)).map((l): Item => ({
      url: l.url,
      title: l.title,
      thumbnail: l.thumbnail,
      channel: 'ELLLO',
      number: l.number,
    })),
  )
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
  return {
    items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    page,
    totalPages,
    hasMore: page < totalPages,
  }
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
      source: z.enum(['elllo', 'youtube']),
      level: z.enum(LEVELS),
      page: z.number().int().min(1).max(CATALOG_MAX_PAGE),
    }),
  )
  .handler(async ({ data }): Promise<CatalogPage> => {
    const res =
      data.source === 'elllo'
        ? await ellloPage(data.level, data.page)
        : await youtubePage(data.level, data.page)
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
