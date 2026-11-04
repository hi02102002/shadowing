import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { chunkSourcesQuery } from '#/lib/queries'

export const Route = createFileRoute('/chunks/sources')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(chunkSourcesQuery()),
  head: () => ({ meta: [{ title: 'Nguồn Chunks · Shadowing' }] }),
  component: ChunkSourcesPage,
})

function ChunkSourcesPage() {
  const { data: sources } = useSuspenseQuery(chunkSourcesQuery())
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex items-start gap-3">
        <Button size="icon" variant="ghost" asChild aria-label="Về kho chunks">
          <Link to="/chunks">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="size-6 text-primary" /> Nguồn và giấy phép
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nguồn “Đang dùng” có record trong snapshot hiện tại. Nguồn “Hỗ trợ”
            đã có chính sách import nhưng chưa xuất hiện trong seed. Nguồn “Chỉ
            tham khảo” không được chép vào seed.
          </p>
        </div>
      </header>

      <div className="divide-y rounded-xl border bg-card">
        {sources.map((source) => (
          <article
            key={source.id}
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start"
          >
            <div className="min-w-0 flex-1">
              <a
                href={source.homepage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold"
              >
                {source.name} <ExternalLink className="size-3.5" />
              </a>
              <p className="mt-1 text-sm text-muted-foreground">
                {source.noteVi}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
              <Badge
                variant={source.usage === 'active' ? 'secondary' : 'outline'}
              >
                {source.usage === 'active'
                  ? 'Đang dùng'
                  : source.usage === 'supported'
                    ? 'Hỗ trợ'
                    : 'Chỉ tham khảo'}
              </Badge>
              <Badge variant="outline">{source.license}</Badge>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
