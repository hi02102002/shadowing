import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Check, Flame, Pencil, Trophy } from 'lucide-react'

import { ActivityHeatmap } from '#/components/activity-heatmap'
import { ScoreTrendChart } from '#/components/score-trend-chart'
import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import { activityStatsQuery, aiUsageQuery, statsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { setDailyGoal } from '#/server/fns/stats'
import type { AiUsageStats } from '#/server/fns/stats'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/stats')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(activityStatsQuery()),
  head: () => ({ meta: [{ title: 'Thống kê · Shadowing' }] }),
  component: StatsPage,
})

function Tile({
  label,
  children,
  sub,
  className,
}: {
  label: string
  children: React.ReactNode
  sub?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border bg-card p-4',
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
        {children}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

const nf = new Intl.NumberFormat('vi-VN')
const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 10_000
      ? `${Math.round(n / 1000)}k`
      : nf.format(n)

function AiUsageSection() {
  const { data } = useQuery(aiUsageQuery())
  if (!data) return null
  return <AiUsageCard data={data} />
}

function AiUsageCard({ data }: { data: AiUsageStats }) {
  const max = Math.max(1, ...data.byFeature.map((f) => f.totalTokens))
  const dailyMax = Math.max(1, ...data.daily.map((d) => d.totalTokens))
  const periods = [
    { label: 'Hôm nay', v: data.today },
    { label: '7 ngày', v: data.week },
    { label: '30 ngày', v: data.month },
  ]
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Mức dùng AI</h2>
        {data.lastModel && (
          <span className="text-xs text-muted-foreground">
            {data.lastModel.provider} · {data.lastModel.model}
          </span>
        )}
      </div>

      {data.month.calls === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có lượt gọi AI nào được ghi nhận.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {periods.map(({ label, v }) => (
              <div key={label} className="flex flex-col gap-0.5 rounded-lg border p-3">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xl font-semibold tabular-nums">
                  {compact(v.totalTokens)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    token
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {nf.format(v.calls)} lượt · vào {compact(v.promptTokens)} / ra{' '}
                  {compact(v.completionTokens)}
                  {v.failed > 0 && ` · ${v.failed} lỗi`}
                </span>
              </div>
            ))}
          </div>

          <div className="flex h-16 items-end gap-1" aria-label="Token theo ngày, 14 ngày gần nhất">
            {data.daily.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${nf.format(d.totalTokens)} token, ${d.calls} lượt`}
                className="min-h-0.5 flex-1 rounded-sm bg-primary/60"
                style={{ height: `${Math.max(3, (d.totalTokens / dailyMax) * 100)}%` }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Theo tính năng (30 ngày)
            </span>
            {data.byFeature.map((f) => (
              <div key={f.feature} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate">{f.feature}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(f.totalTokens / max) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {compact(f.totalTokens)} · {nf.format(f.calls)} lượt
                </span>
              </div>
            ))}
          </div>

          {data.estimatedCalls > 0 && (
            <p className="text-xs text-muted-foreground">
              {data.estimatedCalls} lượt không được provider báo số token nên
              được ước lượng theo độ dài chữ (~4 ký tự/token).
            </p>
          )}
        </>
      )}
    </section>
  )
}

function StatsPage() {
  const { data } = useSuspenseQuery(activityStatsQuery())
  const { streak, goal, totals } = data
  const today = data.days.at(-1)?.total ?? 0

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Thống kê</h1>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Chuỗi ngày học"
          className={cn(
            !streak.today && streak.current > 0 && 'border-miss/50',
          )}
          sub={
            streak.today
              ? 'Hôm nay đã học, giữ vững nhé!'
              : streak.current
                ? 'Hôm nay chưa học — luyện một lượt để giữ chuỗi'
                : 'Luyện một lượt hôm nay để bắt đầu chuỗi'
          }
        >
          <Flame
            className={cn(
              'size-6',
              streak.today ? 'fill-rec/30 text-rec' : 'text-muted-foreground',
            )}
          />
          {streak.current} ngày
        </Tile>
        <Tile
          label="Chuỗi dài nhất"
          sub={`${data.activeDays} ngày đã học tất cả`}
        >
          <Trophy className="size-6 text-miss" />
          {streak.longest} ngày
        </Tile>
        <GoalTile today={today} goal={goal} />
        <Tile
          label="Thẻ đã thuộc"
          sub={`trên ${totals.cardsTotal} thẻ · ${totals.reviews} lượt ôn`}
        >
          {totals.cardsLearned}
        </Tile>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Hoạt động 12 tháng qua</h2>
        <ActivityHeatmap days={data.days} goal={goal} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Điểm trung bình theo tuần</h2>
        {data.trend.some((w) => w.dictation || w.pronunciation) ? (
          <ScoreTrendChart trend={data.trend} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Chưa có lượt chép chính tả hay luyện nói nào trong 12 tuần qua.
          </p>
        )}
      </section>

      <AiUsageSection />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile
          label="Câu chép chính tả"
          sub={
            totals.dictation.avg != null
              ? `điểm TB ${totals.dictation.avg}%`
              : undefined
          }
        >
          {totals.dictation.n}
        </Tile>
        <Tile
          label="Lượt luyện nói"
          sub={
            totals.pronunciation.avg != null
              ? `điểm TB ${totals.pronunciation.avg}%`
              : undefined
          }
        >
          {totals.pronunciation.n}
        </Tile>
        <Tile
          label="Câu ngữ pháp đã làm"
          sub={`${totals.grammar.correct ?? 0} câu đúng`}
        >
          {totals.grammar.n}
        </Tile>
        <Tile
          label="Bài đọc đã làm"
          sub={`${totals.reading.correct ?? 0} câu đúng`}
        >
          {totals.reading.n}
        </Tile>
        <Tile
          label="Bài nghe đã làm"
          sub={`${totals.listening.correct ?? 0} câu đúng`}
        >
          {totals.listening.n}
        </Tile>
        <Tile
          label="Câu phản xạ đã nói"
          sub={
            totals.reflex.avg != null
              ? `điểm TB ${totals.reflex.avg}/10`
              : undefined
          }
        >
          {totals.reflex.n}
        </Tile>
        <Tile label="Lượt ôn thẻ">{totals.reviews}</Tile>
        <Tile label="Lỗi trong sổ">{totals.mistakes}</Tile>
        <Tile label="Video trong thư viện">{totals.videos}</Tile>
      </section>
    </div>
  )
}

/** hôm nay đã luyện bao nhiêu lượt so với mục tiêu; sửa mục tiêu ngay tại đây */
function GoalTile({ today, goal }: { today: number; goal: number }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(goal))
  const save = useMutation({
    mutationFn: (g: number) => setDailyGoal({ data: { goal: g } }),
    onSuccess: () => {
      setEditing(false)
      void queryClient.invalidateQueries({
        queryKey: activityStatsQuery().queryKey,
      })
      void queryClient.invalidateQueries({ queryKey: statsQuery().queryKey })
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
  const n = Math.round(Number(value))

  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="flex items-center justify-between text-sm text-muted-foreground">
        Mục tiêu hôm nay
        {!editing && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
            aria-label="Sửa mục tiêu mỗi ngày"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </span>
      {editing ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (n >= 1 && n <= 500) save.mutate(n)
          }}
        >
          <input
            type="number"
            min={1}
            max={500}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 w-20 rounded-md border bg-background px-2 text-sm"
          />
          <span className="text-sm text-muted-foreground">lượt/ngày</span>
          <Button
            size="icon"
            className="size-8"
            type="submit"
            disabled={save.isPending || !(n >= 1 && n <= 500)}
          >
            <Check />
          </Button>
        </form>
      ) : (
        <span className="text-2xl font-semibold tabular-nums">
          {today}
          <span className="text-base font-normal text-muted-foreground">
            /{goal}
          </span>
          {today >= goal && (
            <span className="ml-2 text-sm font-medium text-ok">Đạt ✓</span>
          )}
        </span>
      )}
      <Progress
        value={Math.min(100, (today / goal) * 100)}
        className="mt-1 h-1.5"
      />
      <span className="text-xs text-muted-foreground">
        câu chép, lượt nói, ôn thẻ, ngữ pháp, đọc và nghe hiểu
      </span>
    </div>
  )
}
