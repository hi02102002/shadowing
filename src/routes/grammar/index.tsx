import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, BookOpen, CheckCircle2, Loader2, Search } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Progress } from '#/components/ui/progress'
import { groupLabel } from '#/lib/grammar'
import { grammarUnitsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import type { GrammarUnitSummary } from '#/server/fns/grammar'

export const Route = createFileRoute('/grammar/')({
  head: () => ({ meta: [{ title: 'Ngữ pháp · Shadowing' }] }),
  component: GrammarPage,
})

function GrammarPage() {
  const { data: units, isPending, error, refetch, isRefetching } = useQuery(grammarUnitsQuery())
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = (units ?? []).filter(
      (u) => !needle || u.id === needle || u.title.toLowerCase().includes(needle) || groupLabel(u.group).toLowerCase().includes(needle),
    )
    const map = new Map<string, GrammarUnitSummary[]>()
    for (const u of filtered) map.set(u.group, [...(map.get(u.group) ?? []), u])
    return [...map]
  }, [units, q])

  const total = units?.reduce((n, u) => n + u.total, 0) ?? 0
  const correct = units?.reduce((n, u) => n + Math.min(u.correct, u.total), 0) ?? 0

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BookOpen className="size-6 text-primary" />
            Ngữ pháp
          </h1>
          <p className="text-sm text-muted-foreground">
            145 bài của English Grammar in Use: đọc lý thuyết, nhờ AI giảng lại bằng tiếng Việt, làm bài tập có chấm điểm
            và xem cấu trúc đó xuất hiện trong video bạn đã học.
          </p>
        </div>
        {!!total && (
          <div className="flex min-w-48 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">
              Đã làm đúng{' '}
              <span className="font-semibold text-foreground">
                {correct}/{total}
              </span>{' '}
              câu
            </span>
            <Progress value={(correct / total) * 100} />
          </div>
        )}
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Tìm bài: số unit, tên chủ điểm…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isPending ? (
        <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang tải sách ngữ pháp (lần đầu cần tải khoảng 2 MB)…
        </p>
      ) : error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertCircle className="size-4" />
            Không tải được dữ liệu
          </div>
          <p className="text-muted-foreground">{error.message}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isRefetching}>
            {isRefetching && <Loader2 className="animate-spin" />}
            Thử lại
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Không có bài nào khớp “{q}”.</p>
      ) : (
        groups.map(([group, list]) => (
          <section key={group}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{groupLabel(group)}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((u) => (
                <UnitCard key={u.id} unit={u} />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="text-xs text-muted-foreground">
        Nội dung: English Grammar in Use (Raymond Murphy, Cambridge University Press), qua essentialenglish.review.
      </p>
    </div>
  )
}

function UnitCard({ unit }: { unit: GrammarUnitSummary }) {
  const pct = unit.total ? (Math.min(unit.correct, unit.total) / unit.total) * 100 : 0
  const appendix = unit.id.startsWith('appendix-')
  return (
    <Link
      to="/grammar/$unitId"
      params={{ unitId: unit.id }}
      className="group flex items-start gap-3 rounded-lg border bg-card p-3 text-foreground no-underline transition-colors hover:border-primary/60 hover:bg-muted"
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-md bg-muted font-mono text-sm font-semibold group-hover:bg-primary group-hover:text-primary-foreground',
          pct === 100 && 'bg-ok-soft text-ok',
        )}
      >
        {appendix ? `P${unit.id.slice(9)}` : unit.id}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-sm leading-snug font-medium">{unit.title}</span>
        {unit.total > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={pct} className="h-1.5" />
            {pct === 100 ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-ok" />
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {Math.min(unit.correct, unit.total)}/{unit.total}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
