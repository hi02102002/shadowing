/** Hoạt động học theo ngày (giờ máy) gộp từ mọi chế độ luyện — dùng cho chuỗi ngày và trang Thống kê */
import { sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'

export const ACTIVITY_KINDS = ['dictation', 'pronunciation', 'review', 'grammar', 'conversation', 'speaking'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

/**
 * mọi lượt luyện: câu chép chính tả, lượt nói, lượt ôn thẻ, câu ngữ pháp, lượt nói trong hội thoại, bài nói theo đề
 * (ngữ pháp chỉ giữ lần làm gần nhất mỗi câu nên tính theo lúc làm lại)
 */
const EVENTS = sql`
  select 'dictation' as kind, created_at as at from dictation_attempts
  union all select 'pronunciation', created_at from pronunciation_attempts
  union all select 'review', reviewed_at from review_logs
  union all select 'grammar', updated_at from grammar_answers
  union all select 'conversation', created_at from conversation_turns where role = 'user'
  union all select 'speaking', created_at from speaking_attempts`

/** các ngày có học (YYYY-MM-DD), toàn bộ lịch sử */
export const activeDays = () =>
  db
    .all<{ day: string }>(sql`select distinct date(at, 'unixepoch', 'localtime') as day from (${EVENTS})`)
    .map((r) => r.day)

/** số lượt luyện mỗi ngày theo từng loại, từ ngày `since` (YYYY-MM-DD) */
export function dailyActivity(since: string) {
  const rows = db.all<{ day: string; kind: ActivityKind; n: number }>(
    sql`select date(at, 'unixepoch', 'localtime') as day, kind, count(*) as n from (${EVENTS})
        where date(at, 'unixepoch', 'localtime') >= ${since} group by day, kind`,
  )
  const days = new Map<string, Record<ActivityKind, number>>()
  for (const r of rows) {
    const d = days.get(r.day) ?? { dictation: 0, pronunciation: 0, review: 0, grammar: 0, conversation: 0, speaking: 0 }
    d[r.kind] = r.n
    days.set(r.day, d)
  }
  return days
}
