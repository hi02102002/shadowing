import { useCallback, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from '@tanstack/react-db'
import { BookX, Loader2 } from 'lucide-react'

import { MistakesTable } from '#/components/mistakes-table'
import { getMistakesCollection } from '#/lib/collections'
import { statsQuery } from '#/lib/queries'
import { mistakeLabel } from '#/server/ai/prompts'

export const Route = createFileRoute('/review')({
  // TanStack DB collection chỉ sống ở client
  ssr: false,
  head: () => ({ meta: [{ title: 'Sổ lỗi · Shadowing' }] }),
  component: Review,
  pendingComponent: () => (
    <div className="grid place-items-center py-24">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

function Review() {
  const queryClient = useQueryClient()
  const mistakes = useMemo(() => getMistakesCollection(queryClient), [queryClient])
  const { data = [], isLoading } = useLiveQuery((q) =>
    q.from({ m: mistakes }).orderBy(({ m }) => m.lastSeenAt, 'desc'),
  )
  const { data: stats } = useQuery(statsQuery())

  const onDelete = useCallback(
    (id: number) => {
      mistakes.delete(id)
      void queryClient.invalidateQueries({ queryKey: statsQuery().queryKey })
    },
    [mistakes, queryClient],
  )

  // nhóm lỗi theo loại → biết mình yếu nhất ở đâu
  const byType = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of data) m.set(r.type, (m.get(r.type) ?? 0) + r.count)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [data])
  const maxCount = byType[0]?.[1] ?? 1

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BookX className="size-6 text-primary" />
          Sổ lỗi
        </h1>
        <p className="text-sm text-muted-foreground">
          Mọi lỗi AI phát hiện khi bạn chép chính tả và luyện nói đều nằm ở đây. Lỗi lặp lại nhiều lần được đẩy lên đầu.
          Bấm 🏋️ để luyện lại đúng câu đó.
        </p>
      </header>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Lỗi đang theo dõi" value={stats.mistakeCount} />
          <Card label="Điểm chép chính tả TB" value={`${stats.dictationAvg}%`} />
          <Card label="Điểm phát âm TB" value={`${stats.pronunciationAvg}%`} />
          <Card label="Chuỗi ngày luyện" value={`${stats.streak} 🔥`} />
        </div>
      )}

      {byType.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Điểm yếu theo loại lỗi</h2>
          <ul className="flex flex-col gap-2">
            {byType.map(([type, count]) => (
              <li key={type} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="truncate">{mistakeLabel(type)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(count / maxCount) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-xs text-muted-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Chưa có lỗi nào. Hãy luyện chép chính tả hoặc phát âm, AI sẽ ghi lại những chỗ bạn cần cải thiện.
        </div>
      ) : (
        <MistakesTable data={data} onDelete={onDelete} />
      )}
    </div>
  )
}

function Card({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}
