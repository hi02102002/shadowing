import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { dictationAttempts, mistakes, pronunciationAttempts, segments, videos } from '#/db/schema.ts'
import { computeStreak, dayKey } from '#/lib/streak.ts'
import { activeDays } from '../activity.ts'

export const listMistakes = createServerFn({ method: 'GET' }).handler(async () =>
  db
    .select({
      id: mistakes.id,
      word: mistakes.word,
      heard: mistakes.heard,
      type: mistakes.type,
      source: mistakes.source,
      explanation: mistakes.explanation,
      tip: mistakes.tip,
      ipa: mistakes.ipa,
      grammarRef: mistakes.grammarRef,
      count: mistakes.count,
      lastSeenAt: mistakes.lastSeenAt,
      segmentIdx: segments.idx,
      segmentText: segments.text,
      youtubeId: videos.youtubeId,
      videoTitle: videos.title,
    })
    .from(mistakes)
    .leftJoin(segments, eq(segments.id, mistakes.segmentId))
    .leftJoin(videos, eq(videos.id, segments.videoId))
    .orderBy(desc(mistakes.lastSeenAt))
    .all(),
)

export type MistakeRow = Awaited<ReturnType<typeof listMistakes>>[number]

export const deleteMistake = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    db.delete(mistakes).where(eq(mistakes.id, data.id)).run()
    return { ok: true }
  })

export const practiceStats = createServerFn({ method: 'GET' }).handler(async () => {
  const dict = db
    .select({ n: sql<number>`count(*)`, avg: sql<number>`coalesce(avg(${dictationAttempts.score}), 0)` })
    .from(dictationAttempts)
    .get()!
  const p = db
    .select({
      n: sql<number>`count(*)`,
      avg: sql<number>`coalesce(avg(${pronunciationAttempts.accuracy}), 0)`,
    })
    .from(pronunciationAttempts)
    .get()!
  const m = db.select({ n: sql<number>`count(*)` }).from(mistakes).get()!
  // chuỗi ngày học: mọi chế độ luyện (chép, nói, ôn thẻ, ngữ pháp, hội thoại, nói theo đề)
  const streak = computeStreak(activeDays(), dayKey(new Date()))
  return {
    dictationCount: dict.n,
    dictationAvg: Math.round(dict.avg),
    pronunciationCount: p.n,
    pronunciationAvg: Math.round(p.avg),
    mistakeCount: m.n,
    streak: streak.current,
    /** hôm nay đã học chưa (chưa thì chuỗi sắp mất) */
    practicedToday: streak.today,
  }
})
