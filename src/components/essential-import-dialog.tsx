import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, Check, ChevronRight, Loader2 } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { essentialBookQuery, essentialBooksQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { importEssentialBook } from '#/server/fns/essential'
import type { EssentialBookRow } from '#/server/fns/essential'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (deckId: number) => void
}

export function EssentialImportDialog({ open, onOpenChange, onImported }: Props) {
  const queryClient = useQueryClient()
  const [book, setBook] = useState<EssentialBookRow | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())

  const submit = useMutation({
    mutationFn: () => importEssentialBook({ data: { slug: book!.slug, units: [...picked].sort((a, b) => a - b) } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['essential-books'] })
      void queryClient.invalidateQueries({ queryKey: ['essential-book'] })
    },
  })

  const choose = (b: EssentialBookRow | null) => {
    setBook(b)
    setPicked(new Set())
    submit.reset()
  }

  const close = (next: boolean) => {
    if (next) return onOpenChange(true)
    if (submit.data?.deckId != null) onImported(submit.data.deckId)
    choose(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {book && !submit.data && (
              <Button size="icon" variant="ghost" className="-ml-2 size-8" onClick={() => choose(null)} aria-label="Chọn sách khác">
                <ArrowLeft />
              </Button>
            )}
            {book?.title ?? 'Thư viện từ vựng'}
          </DialogTitle>
          <DialogDescription>
            {book
              ? 'Chọn các unit muốn học, mỗi unit thành một bộ thẻ riêng. Ảnh và audio tải về khi học lần đầu.'
              : 'Bộ từ vựng của essentialenglish.review. Mỗi unit một bộ thẻ, gộp theo sách; có thể thêm dần từng unit.'}
          </DialogDescription>
        </DialogHeader>

        {submit.data ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-base font-medium">Đã thêm {submit.data.added} thẻ.</p>
            {submit.data.skipped > 0 && (
              <p className="text-muted-foreground">Bỏ qua {submit.data.skipped} từ đã có trong bộ thẻ.</p>
            )}
            <DialogFooter>
              <Button onClick={() => close(false)}>Xong</Button>
            </DialogFooter>
          </div>
        ) : book ? (
          <UnitPicker
            slug={book.slug}
            picked={picked}
            onPickedChange={setPicked}
            pending={submit.isPending}
            error={submit.error?.message}
            onCancel={() => close(false)}
            onSubmit={() => submit.mutate()}
          />
        ) : (
          <BookList onChoose={choose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function BookList({ onChoose }: { onChoose: (b: EssentialBookRow) => void }) {
  const { data = [], isLoading } = useQuery(essentialBooksQuery())
  const series = useMemo(() => {
    const groups = new Map<string, EssentialBookRow[]>()
    for (const b of data) groups.set(b.series, [...(groups.get(b.series) ?? []), b])
    return groups
  }, [data])

  if (isLoading) return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
  return (
    <div className="-mx-1 flex flex-col gap-4 overflow-y-auto px-1">
      {[...series].map(([name, books]) => (
        <section key={name} className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{name}</h3>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {books.map((b) => (
              <button
                key={b.slug}
                type="button"
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
                onClick={() => onChoose(b)}
              >
                <BookOpen className="size-4 shrink-0 text-primary" />
                <span className="flex-1">{b.title}</span>
                {b.added && <Badge variant="secondary">Đã thêm</Badge>}
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function UnitPicker({
  slug,
  picked,
  onPickedChange,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  slug: string
  picked: Set<number>
  onPickedChange: (s: Set<number>) => void
  pending: boolean
  error?: string
  onCancel: () => void
  onSubmit: () => void
}) {
  const { data: units = [], isLoading, error: loadError } = useQuery(essentialBookQuery(slug))
  // unit đã thêm đủ từ thì không cần chọn lại
  const open = units.filter((u) => u.imported < u.total)
  const allPicked = open.length > 0 && open.every((u) => picked.has(u.index))
  const words = units.reduce((n, u) => n + (picked.has(u.index) ? u.total - u.imported : 0), 0)

  const toggle = (index: number) => {
    const next = new Set(picked)
    if (!next.delete(index)) next.add(index)
    onPickedChange(next)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Đang tải sách…
      </div>
    )
  }
  if (loadError) return <p className="text-sm text-destructive">{loadError.message}</p>

  return (
    <>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={allPicked}
          disabled={!open.length}
          onChange={() => onPickedChange(allPicked ? new Set() : new Set(open.map((u) => u.index)))}
        />
        Chọn tất cả ({units.length} unit)
      </label>
      <ul className="-mx-1 flex min-h-0 flex-col gap-1 overflow-y-auto px-1">
        {units.map((u) => {
          const done = u.imported >= u.total
          return (
            <li key={u.index}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                  picked.has(u.index) && 'border-primary bg-primary/5',
                  done && 'cursor-default opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={done || picked.has(u.index)}
                  disabled={done}
                  onChange={() => toggle(u.index)}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{u.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{u.preview.join(', ')}…</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {done ? (
                    <>
                      <Check className="size-3.5 text-ok" /> {u.total} từ
                    </>
                  ) : u.imported > 0 ? (
                    `${u.imported}/${u.total} từ`
                  ) : (
                    `${u.total} từ`
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Huỷ
        </Button>
        <Button disabled={!words || pending} onClick={onSubmit}>
          {pending && <Loader2 className="animate-spin" />}
          Thêm {words} từ vào bộ thẻ
        </Button>
      </DialogFooter>
    </>
  )
}
