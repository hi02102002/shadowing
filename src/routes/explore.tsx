import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AudioLines, CheckCircle2, Loader2, RotateCw } from 'lucide-react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { useVideoImport } from '#/hooks/use-video-import'
import { formatDuration } from '#/lib/format'
import { LEVEL_LABEL, LEVELS } from '#/lib/levels'
import { catalogQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import type { CatalogItem } from '#/server/fns/catalog'

const searchSchema = z.object({
  level: z.enum(LEVELS).catch('A1'),
  source: z.enum(['elllo', 'youtube']).catch('elllo'),
})

export const Route = createFileRoute('/explore')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Khám phá · Shadowing' }] }),
  component: Explore,
})

const SOURCES = [
  { id: 'elllo', label: 'elllo.org' },
  { id: 'youtube', label: 'YouTube' },
] as const

const SKELETONS = ['s1', 's2', 's3', 's4', 's5', 's6']

function Explore() {
  const { level, source } = Route.useSearch()
  const catalog = useQuery(catalogQuery(source, level))
  const { importUrl, importing, error, dialog } = useVideoImport()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Bài nghe theo cấp độ
        </h1>
        <p className="text-muted-foreground">
          Chọn cấp độ CEFR phù hợp, bấm vào một bài để thêm vào thư viện và bắt
          đầu luyện.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav
          className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
          aria-label="Cấp độ"
        >
          {LEVELS.map((l) => (
            <Link
              key={l}
              to="/explore"
              search={{ level: l, source }}
              className={cn(
                'flex flex-col items-center rounded-md px-3 py-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground',
                l === level && 'bg-background text-foreground shadow-sm',
              )}
            >
              <span className="font-semibold">{l}</span>
              <span className="hidden text-[11px] sm:inline">
                {LEVEL_LABEL[l]}
              </span>
            </Link>
          ))}
        </nav>
        <nav
          className="ml-auto flex gap-1 rounded-lg bg-muted p-1"
          aria-label="Nguồn"
        >
          {SOURCES.map((s) => (
            <Link
              key={s.id}
              to="/explore"
              search={{ level, source: s.id }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground',
                s.id === source && 'bg-background text-foreground shadow-sm',
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {catalog.isPending ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETONS.map((k) => (
            <li
              key={k}
              className="flex flex-col overflow-hidden rounded-xl border bg-card"
            >
              <div className="aspect-video animate-pulse bg-muted" />
              <div className="flex flex-col gap-2 p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      ) : catalog.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <p>Không tải được danh sách: {catalog.error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void catalog.refetch()}
            disabled={catalog.isFetching}
          >
            <RotateCw className={cn(catalog.isFetching && 'animate-spin')} />
            Thử lại
          </Button>
        </div>
      ) : catalog.data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Không có bài nào cho cấp độ này.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.data.map((item) => (
            <CatalogCard
              key={item.url}
              item={item}
              loading={importing === item.url}
              disabled={importing !== null}
              onPick={() => importUrl(item.url)}
            />
          ))}
        </ul>
      )}

      {dialog}
    </div>
  )
}

function CatalogCard({
  item,
  loading,
  disabled,
  onPick,
}: {
  item: CatalogItem
  loading: boolean
  disabled: boolean
  onPick: () => void
}) {
  const body = (
    <>
      <div className="relative aspect-video bg-muted">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            // elllo chặn hotlink theo Referer
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        ) : (
          <AudioLines className="absolute inset-0 m-auto size-12 text-muted-foreground/40" />
        )}
        {item.durationSec && (
          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-xs text-white">
            {formatDuration(item.durationSec)}
          </span>
        )}
        {item.imported && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
            <CheckCircle2 className="size-3.5" />
            Đã có
          </span>
        )}
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-background/60">
            <Loader2 className="size-8 animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h3 className="line-clamp-2 font-medium leading-snug">{item.title}</h3>
        <span className="truncate text-xs text-muted-foreground">
          {item.number ? `Video ${item.number} · ` : ''}
          {item.channel}
        </span>
      </div>
    </>
  )
  const card =
    'flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-shadow hover:shadow-md'

  return (
    <li>
      {item.imported && item.youtubeId ? (
        <Link
          to="/videos/$videoId"
          params={{ videoId: item.youtubeId }}
          className={cn(card, 'size-full text-foreground no-underline')}
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          className={cn(
            card,
            'size-full cursor-pointer disabled:cursor-default',
            disabled && !loading && 'opacity-60',
          )}
        >
          {body}
        </button>
      )}
    </li>
  )
}
