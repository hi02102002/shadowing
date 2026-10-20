import { createServerFn } from '@tanstack/react-start'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { videos } from '#/db/schema.ts'
import { LEVELS } from '#/lib/levels.ts'
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

const YT_QUERY: Record<Level, string> = {
  A1: 'A1 English listening practice beginner',
  A2: 'A2 English listening practice elementary',
  B1: 'B1 English listening practice intermediate',
  B2: 'B2 English listening practice upper intermediate',
  C1: 'C1 English listening practice advanced',
}
const YT_LIMIT = 30

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<
  string,
  { at: number; items: Omit<CatalogItem, 'imported'>[] }
>()

async function load(
  source: CatalogSource,
  level: Level,
): Promise<Omit<CatalogItem, 'imported'>[]> {
  if (source === 'elllo') {
    const lessons = await fetchEllloLevel(level)
    return lessons.map((l) => ({
      url: l.url,
      title: l.title,
      thumbnail: l.thumbnail,
      channel: 'ELLLO',
      number: l.number,
    }))
  }
  const entries = await searchVideos(YT_QUERY[level], YT_LIMIT)
  return (
    entries
      // bỏ livestream (không có thời lượng) và Shorts
      .filter((e) => e.duration && e.duration >= 60)
      .map((e) => ({
        url: watchUrl(e.id),
        title: e.title,
        thumbnail: youtubeThumbnail(e.id),
        durationSec: Math.round(e.duration!),
        channel: e.channel,
        youtubeId: e.id,
      }))
  )
}

export const listCatalog = createServerFn({ method: 'GET' })
  .validator(
    z.object({ source: z.enum(['elllo', 'youtube']), level: z.enum(LEVELS) }),
  )
  .handler(async ({ data }): Promise<CatalogItem[]> => {
    const key = `${data.source}:${data.level}`
    let hit = cache.get(key)
    if (!hit || Date.now() - hit.at > CACHE_MS) {
      hit = { at: Date.now(), items: await load(data.source, data.level) }
      cache.set(key, hit)
    }
    const ids = hit.items.flatMap((i) => (i.youtubeId ? [i.youtubeId] : []))
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
    return hit.items.map((i) => ({
      ...i,
      imported: !!i.youtubeId && owned.has(i.youtubeId),
    }))
  })
