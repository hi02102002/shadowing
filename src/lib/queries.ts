import { queryOptions } from '@tanstack/react-query'

import { listCatalog } from '#/server/fns/catalog.ts'
import type { CatalogSource } from '#/server/fns/catalog.ts'
import { dictationHistory } from '#/server/fns/dictation.ts'
import { pronunciationHistory } from '#/server/fns/pronunciation.ts'
import { listMistakes, practiceStats } from '#/server/fns/review.ts'
import { getSettings } from '#/server/fns/settings.ts'
import { getVideo, listVideos } from '#/server/fns/videos.ts'
import type { Level } from './levels.ts'

export const videosQuery = () =>
  queryOptions({
    queryKey: ['videos'],
    queryFn: () => listVideos(),
  })

export const videoQuery = (youtubeId: string) =>
  queryOptions({
    queryKey: ['video', youtubeId],
    queryFn: () => getVideo({ data: { youtubeId } }),
    staleTime: 60_000,
  })

export const settingsQuery = () =>
  queryOptions({
    queryKey: ['settings'],
    queryFn: () => getSettings(),
  })

export const statsQuery = () =>
  queryOptions({
    queryKey: ['stats'],
    queryFn: () => practiceStats(),
  })

export const mistakesQueryKey = ['mistakes'] as const
export const fetchMistakes = () => listMistakes()

export const dictationHistoryQuery = (segmentId: number) =>
  queryOptions({
    queryKey: ['dictation-history', segmentId],
    queryFn: () => dictationHistory({ data: { segmentId } }),
  })

export const pronunciationHistoryQuery = (segmentId: number) =>
  queryOptions({
    queryKey: ['pronunciation-history', segmentId],
    queryFn: () => pronunciationHistory({ data: { segmentId } }),
  })

export const catalogQuery = (source: CatalogSource, level: Level) =>
  queryOptions({
    queryKey: ['catalog', source, level],
    queryFn: () => listCatalog({ data: { source, level } }),
    staleTime: 60 * 60_000,
  })
