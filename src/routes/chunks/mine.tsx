import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  FileUp,
  Loader2,
  Lock,
  Mic,
  Search,
  Trash2,
} from 'lucide-react'

import {
  ChunkShadow,
  ListenButton,
  SaveChunkButton,
} from '#/components/chunk-actions'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Progress } from '#/components/ui/progress'
import { CHUNK_KIND_LABELS } from '#/lib/chunks'
import { userChunkImportsQuery, userChunksQuery } from '#/lib/queries'
import {
  deleteUserChunk,
  deleteUserChunkImport,
  importUserChunks,
} from '#/server/fns/chunks'
import type { UserChunkRow } from '#/server/fns/chunks'

export const Route = createFileRoute('/chunks/mine')({
  head: () => ({ meta: [{ title: 'Chunks của bạn · Shadowing' }] }),
  component: MyChunksPage,
})

function MyChunksPage() {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [q, setQ] = useState('')
  const [importId, setImportId] = useState<number | undefined>()
  const imports = useQuery(userChunkImportsQuery())
  const running = imports.data?.some(
    (i) => i.status === 'running' || i.status === 'queued',
  )
  const list = useQuery({
    ...userChunksQuery({ importId, q: q.trim() || undefined }),
    refetchInterval: running ? 5000 : false,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: userChunkImportsQuery().queryKey,
    })
    void queryClient.invalidateQueries({ queryKey: ['user-chunks'] })
  }

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Hãy chọn tệp')
      const form = new FormData()
      form.set('file', file)
      if (label.trim()) form.set('label', label.trim())
      return importUserChunks({ data: form })
    },
    onSuccess: () => {
      setFile(null)
      setLabel('')
      refresh()
    },
  })
  const removeImport = useMutation({
    mutationFn: (id: number) => deleteUserChunkImport({ data: { id } }),
    onSuccess: () => {
      setImportId(undefined)
      refresh()
    },
  })

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link
          to="/chunks"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Kho Chunks
        </Link>
        <h1 className="text-2xl font-semibold">Chunks của bạn</h1>
        <p className="flex max-w-3xl items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Nhập tài liệu bạn đang có (vd. bản PDF “The Book of Chunks” bạn đã
          tải). AI lấy ra các chunk có trong tài liệu và gợi ý nghĩa tiếng Việt.
          Dữ liệu chỉ lưu trên máy bạn, không chia sẻ hay đóng gói vào ứng dụng
          — hãy dùng tài liệu bạn có quyền sử dụng.
        </p>
      </header>

      <form
        className="flex flex-col gap-3 rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          upload.mutate()
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tệp PDF hoặc văn bản (.txt, .md)
            <input
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
            />
          </label>
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium">
            Tên tài liệu (không bắt buộc)
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={200}
              placeholder="The Book of Chunks"
            />
          </label>
          <Button type="submit" disabled={!file || upload.isPending}>
            {upload.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <FileUp />
            )}{' '}
            Nhập chunks
          </Button>
        </div>
        {upload.error && (
          <p role="alert" className="text-sm text-destructive">
            {upload.error.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Cần cấu hình AI trong Cài đặt. Mỗi khoảng vài trang là một lượt gọi
          AI; tài liệu dài có thể mất vài phút, bạn có thể rời trang.
        </p>
      </form>

      {(imports.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Tài liệu đã nhập</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {imports.data?.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setImportId(importId === row.id ? undefined : row.id)
                    }
                    className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                  >
                    {row.label}
                  </button>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.chunks} chunk · {row.pages} trang
                    {row.status === 'done' && ' · xong'}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Xoá tài liệu và các chunk của nó"
                    onClick={() => removeImport.mutate(row.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {(row.status === 'running' || row.status === 'queued') && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Đang tách chunk… trang {row.donePages}/{row.pages}
                    <Progress
                      value={row.pages ? (row.donePages / row.pages) * 100 : 0}
                      className="h-1.5 max-w-60"
                    />
                  </div>
                )}
                {row.status === 'error' && (
                  <p className="text-xs text-destructive">{row.error}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            {importId
              ? imports.data?.find((i) => i.id === importId)?.label
              : 'Tất cả chunk của bạn'}{' '}
            <span className="font-normal text-muted-foreground">
              · {list.data?.length ?? 0}
            </span>
          </h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm chunk…"
              className="pl-8"
            />
          </div>
        </div>
        {list.isLoading ? (
          <Loader2 className="mx-auto animate-spin text-muted-foreground" />
        ) : list.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.data.map((row) => (
              <UserChunkCard key={row.id} row={row} onDeleted={refresh} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            Chưa có chunk nào. Nhập một tài liệu ở trên để bắt đầu.
          </p>
        )}
      </section>
    </div>
  )
}

function UserChunkCard({
  row,
  onDeleted,
}: {
  row: UserChunkRow
  onDeleted: () => void
}) {
  const [shadow, setShadow] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: () => deleteUserChunk({ data: { id: row.id } }),
    onSuccess: onDeleted,
  })
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">
          {(CHUNK_KIND_LABELS as Partial<Record<string, string>>)[row.kind] ??
            row.kind}
        </Badge>
        <span className="truncate text-xs text-muted-foreground">
          {row.label}
          {row.page ? ` · trang ${row.page}` : ''}
        </span>
      </div>
      <div className="flex items-start gap-1">
        <h3 className="flex-1 text-lg font-semibold leading-snug">
          {row.text}
        </h3>
        <ListenButton text={row.text} />
      </div>
      {row.meaningVi && (
        <p className="text-sm text-muted-foreground">
          {row.meaningVi} <span className="text-xs">(AI gợi ý)</span>
        </p>
      )}
      {row.exampleEn && (
        <div className="flex items-start gap-1 border-t pt-2 text-sm">
          <p className="flex-1">{row.exampleEn}</p>
          <ListenButton text={row.exampleEn} />
          <button
            type="button"
            title="Nói theo câu này"
            aria-label={`Nói theo: ${row.exampleEn}`}
            onClick={() => setShadow(row.exampleEn)}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Mic className="size-4" />
          </button>
        </div>
      )}
      {shadow && <ChunkShadow text={shadow} onClose={() => setShadow(null)} />}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <SaveChunkButton target={{ userChunkId: row.id }} saved={row.saved} />
        <Button size="sm" variant="outline" onClick={() => setShadow(row.text)}>
          <Mic /> Nói theo
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto size-8 text-muted-foreground hover:text-destructive"
          title="Xoá chunk này"
          onClick={() => remove.mutate()}
        >
          <Trash2 />
        </Button>
      </div>
    </article>
  )
}
