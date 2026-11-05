import { createServerFn } from '@tanstack/react-start'
import { sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { addDays, computeStreak, dayKey } from '#/lib/streak.ts'
import { ACTIVITY_KINDS, activeDays, dailyActivity } from '../activity.ts'
import type { ActivityKind } from '../activity.ts'
import { getConfig, saveConfig } from '../config.ts'

/** lịch hoạt động: 53 tuần gần nhất (bắt đầu từ thứ Hai) */
const HEATMAP_WEEKS = 53
/** xu hướng điểm: 12 tuần gần nhất */
const TREND_WEEKS = 12

/** thứ Hai của tuần chứa `day` */
const mondayOf = (day: string) => {
  const dow = new Date(`${day}T12:00:00`).getDay() // 0 = Chủ nhật
  return addDays(day, -((dow + 6) % 7))
}

const one = <T>(q: ReturnType<typeof sql>) => db.get<T>(q)

/** Thống kê cho trang /stats: chuỗi ngày, lịch hoạt động, xu hướng điểm theo tuần, tổng số */
export const activityStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const today = dayKey(new Date())
    const start = addDays(mondayOf(today), -(HEATMAP_WEEKS - 1) * 7)
    const daily = dailyActivity(start)
    const days: Array<
      { day: string } & Record<ActivityKind, number> & { total: number }
    > = []
    for (let d = start; d <= today; d = addDays(d, 1)) {
      const c = daily.get(d) ?? {
        dictation: 0,
        pronunciation: 0,
        review: 0,
        grammar: 0,
        conversation: 0,
        speaking: 0,
        reading: 0,
        listening: 0,
        reflex: 0,
      }
      days.push({
        day: d,
        ...c,
        total: ACTIVITY_KINDS.reduce((n, k) => n + c[k], 0),
      })
    }

    const all = activeDays()
    const streak = computeStreak(all, today)

    // điểm trung bình mỗi tuần (thứ Hai đầu tuần) của chép chính tả và phát âm
    const trendStart = addDays(mondayOf(today), -(TREND_WEEKS - 1) * 7)
    const weekly = (table: string, column: string) =>
      new Map(
        db
          .all<{ week: string; avg: number; n: number }>(
            sql`select date(created_at, 'unixepoch', 'localtime', 'weekday 0', '-6 days') as week,
                avg(${sql.raw(column)}) as avg, count(*) as n
              from ${sql.raw(table)}
              where date(created_at, 'unixepoch', 'localtime') >= ${trendStart}
              group by week`,
          )
          .map((r) => [r.week, { avg: Math.round(r.avg), n: r.n }]),
      )
    const dict = weekly('dictation_attempts', 'score')
    const pron = weekly('pronunciation_attempts', 'accuracy')
    const trend = Array.from({ length: TREND_WEEKS }, (_, i) => {
      const week = addDays(trendStart, i * 7)
      return {
        week,
        dictation: dict.get(week) ?? null,
        pronunciation: pron.get(week) ?? null,
      }
    })

    const totals = {
      dictation: one<{ n: number; avg: number | null }>(
        sql`select count(*) as n, round(avg(score)) as avg from dictation_attempts`,
      ),
      pronunciation: one<{ n: number; avg: number | null }>(
        sql`select count(*) as n, round(avg(accuracy)) as avg from pronunciation_attempts`,
      ),
      reviews: one<{ n: number }>(sql`select count(*) as n from review_logs`).n,
      // thẻ đã vào giai đoạn ôn dài hạn (FSRS state Review)
      cardsLearned: one<{ n: number }>(
        sql`select count(*) as n from cards where state = 2`,
      ).n,
      cardsTotal: one<{ n: number }>(sql`select count(*) as n from cards`).n,
      grammar: one<{ n: number; correct: number | null }>(
        sql`select count(*) as n, sum(correct) as correct from grammar_answers`,
      ),
      reading: one<{ n: number; correct: number | null }>(
        sql`select count(*) as n, sum(score) as correct from reading_passages where answers is not null`,
      ),
      listening: one<{ n: number; correct: number | null }>(
        sql`select count(*) as n, sum(score) as correct from listening_passages where answers is not null`,
      ),
      reflex: one<{ n: number; avg: number | null }>(
        sql`select count(*) as n, round(avg(score), 1) as avg from reflex_items where answered_at is not null`,
      ),
      mistakes: one<{ n: number }>(sql`select count(*) as n from mistakes`).n,
      videos: one<{ n: number }>(sql`select count(*) as n from videos`).n,
    }

    return {
      today,
      goal: getConfig().dailyGoal,
      streak,
      activeDays: all.length,
      days,
      trend,
      totals,
    }
  },
)

export type ActivityStats = Awaited<ReturnType<typeof activityStats>>

export const setDailyGoal = createServerFn({ method: 'POST' })
  .validator(z.object({ goal: z.number().int().min(1).max(500) }))
  .handler(async ({ data }) => {
    saveConfig({ dailyGoal: data.goal })
    return { goal: data.goal }
  })

export interface AiUsageTotals {
  calls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  failed: number
}

const ZERO: AiUsageTotals = {
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  failed: 0,
}

/** Thống kê dùng AI: tổng theo hôm nay / 7 ngày / 30 ngày, theo tính năng và theo ngày (14 ngày) */
export const aiUsageStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const now = Math.floor(Date.now() / 1000)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const today = Math.floor(startOfToday.getTime() / 1000)
    const since = (days: number) => today - (days - 1) * 86400

    const totals = (from: number) =>
      db.get<AiUsageTotals>(sql`
        select count(*) as calls,
          coalesce(sum(prompt_tokens), 0) as promptTokens,
          coalesce(sum(completion_tokens), 0) as completionTokens,
          coalesce(sum(total_tokens), 0) as totalTokens,
          coalesce(sum(case when ok then 0 else 1 end), 0) as failed
        from ai_usage where created_at >= ${from} and created_at <= ${now}`) ??
      ZERO

    const byFeature = db.all<
      AiUsageTotals & { feature: string; estimated: number }
    >(sql`
      select feature, count(*) as calls,
        coalesce(sum(prompt_tokens), 0) as promptTokens,
        coalesce(sum(completion_tokens), 0) as completionTokens,
        coalesce(sum(total_tokens), 0) as totalTokens,
        coalesce(sum(case when ok then 0 else 1 end), 0) as failed,
        coalesce(sum(estimated), 0) as estimated
      from ai_usage where created_at >= ${since(30)}
      group by feature order by totalTokens desc`)

    const daily = db.all<{ day: string; totalTokens: number; calls: number }>(sql`
      select strftime('%Y-%m-%d', created_at, 'unixepoch', 'localtime') as day,
        coalesce(sum(total_tokens), 0) as totalTokens, count(*) as calls
      from ai_usage where created_at >= ${since(14)}
      group by day order by day`)

    const model = db.get<{ provider: string; model: string }>(
      sql`select provider, model from ai_usage order by id desc limit 1`,
    )
    const estimatedCalls =
      db.get<{ n: number }>(
        sql`select count(*) as n from ai_usage where estimated and created_at >= ${since(30)}`,
      )?.n ?? 0

    return {
      today: totals(today),
      week: totals(since(7)),
      month: totals(since(30)),
      byFeature,
      daily,
      lastModel: model ?? null,
      estimatedCalls,
    }
  },
)

export type AiUsageStats = Awaited<ReturnType<typeof aiUsageStats>>
