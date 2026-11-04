import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Blocks,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileUp,
  Mic,
  Search,
} from 'lucide-react'
import { z } from 'zod'

import {
  ChunkShadow,
  ListenButton,
  SaveChunkButton,
} from '#/components/chunk-actions'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  CHUNK_KINDS,
  CHUNK_KIND_LABELS,
  CHUNK_LEVELS,
  CHUNK_TOPIC_LABELS,
  CHUNK_TOPICS,
} from '#/lib/chunks'
import { chunksQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import type { ChunkSeed } from '#/lib/chunks'

const searchSchema = z.object({
  level: z.enum(CHUNK_LEVELS).optional().catch(undefined),
  topic: z.enum(CHUNK_TOPICS).optional().catch(undefined),
  kind: z.enum(CHUNK_KINDS).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})

export const Route = createFileRoute('/chunks/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(chunksQuery(deps)),
  head: () => ({ meta: [{ title: 'Chunks · Shadowing' }] }),
  component: ChunksPage,
})

function ChunksPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/chunks/' })
  const { data } = useSuspenseQuery(chunksQuery(search))

  const patchSearch = (patch: Partial<typeof search>) =>
    void navigate({
      search: (previous) => ({ ...previous, ...patch, page: 1 }),
    })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Blocks className="size-6 text-primary" /> Kho Chunks
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {Object.values(data.levelCounts).reduce(
              (total, count) => total + count,
              0,
            )}{' '}
            câu và cụm A1–C1 có nguồn Anh–Việt, đóng cùng ứng dụng để học
            offline. Kho không đặt giới hạn số lượng và không dùng câu tự biên
            soạn. Bấm loa để nghe, micro để nói theo và chấm phát âm.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/chunks/mine">
              <FileUp /> Chunks của bạn
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/chunks/sources">
              <ExternalLink /> Nguồn & giấy phép
            </Link>
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="relative max-w-xl">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q ?? ''}
            onChange={(event) =>
              patchSearch({ q: event.target.value || undefined })
            }
            placeholder="Tìm cụm tiếng Anh hoặc nghĩa tiếng Việt…"
            className="pl-8"
          />
        </div>
        <FilterRow
          label="Cấp độ"
          values={CHUNK_LEVELS}
          active={search.level}
          allLabel="Tất cả cấp"
          getLabel={(level) => `${level} · ${data.levelCounts[level]}`}
          onChange={(level) => patchSearch({ level })}
        />
        <FilterRow
          label="Chủ đề"
          values={CHUNK_TOPICS}
          active={search.topic}
          allLabel="Tất cả chủ đề"
          getLabel={(topic) => CHUNK_TOPIC_LABELS[topic]}
          onChange={(topic) => patchSearch({ topic })}
        />
        <FilterRow
          label="Loại"
          values={CHUNK_KINDS}
          active={search.kind}
          allLabel="Tất cả loại"
          getLabel={(kind) =>
            `${CHUNK_KIND_LABELS[kind]} · ${data.kindCounts[kind]}`
          }
          onChange={(kind) => patchSearch({ kind })}
        />
      </section>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {data.total} chunk phù hợp
        </span>
        <span className="tabular-nums text-muted-foreground">
          Trang {data.page}/{data.pages}
        </span>
      </div>

      {data.items.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((chunk) => (
            <ChunkCard
              key={chunk.id}
              chunk={chunk}
              saved={data.saved.includes(chunk.id)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          Không có chunk nào khớp bộ lọc.
        </p>
      )}

      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          disabled={data.page <= 1}
          onClick={() =>
            void navigate({ search: { ...search, page: data.page - 1 } })
          }
        >
          <ChevronLeft /> Trước
        </Button>
        <Button
          variant="outline"
          disabled={data.page >= data.pages}
          onClick={() =>
            void navigate({ search: { ...search, page: data.page + 1 } })
          }
        >
          Sau <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

function FilterRow<T extends string>({
  label,
  values,
  active,
  allLabel,
  getLabel,
  onChange,
}: {
  label: string
  values: readonly T[]
  active?: T
  allLabel: string
  getLabel: (value: T) => string
  onChange: (value: T | undefined) => void
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        <FilterButton active={!active} onClick={() => onChange(undefined)}>
          {allLabel}
        </FilterButton>
        {values.map((value) => (
          <FilterButton
            key={value}
            active={active === value}
            onClick={() => onChange(value)}
          >
            {getLabel(value)}
          </FilterButton>
        ))}
      </div>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

const tatoebaUrl = (id: string) => `https://tatoeba.org/en/sentences/show/${id}`

function ChunkCard({ chunk, saved }: { chunk: ChunkSeed; saved: boolean }) {
  const [shadow, setShadow] = useState<string | null>(null)
  const content = chunk.attributions.find((a) => a.role === 'content')
  const examples = chunk.examples.length
    ? chunk.examples
    : chunk.exampleEn !== chunk.text || chunk.exampleVi !== chunk.meaningVi
      ? [{ en: chunk.exampleEn, vi: chunk.exampleVi, enId: '', viId: '' }]
      : []
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap gap-1.5">
        <Badge>{chunk.level}</Badge>
        <Badge variant="secondary">{CHUNK_TOPIC_LABELS[chunk.topic]}</Badge>
        <Badge variant="outline">{CHUNK_KIND_LABELS[chunk.kind]}</Badge>
      </div>
      <div className="min-w-0">
        <div className="flex items-start gap-1">
          <h2 className="flex-1 text-lg font-semibold leading-snug">
            {chunk.text}
          </h2>
          <ListenButton
            text={chunk.text}
            audioUrl={chunk.exampleEn === chunk.text ? chunk.audioUrl : null}
          />
        </div>
        {chunk.meaningVi && (
          <p className="mt-1 text-sm text-muted-foreground">
            {chunk.meaningVi}
          </p>
        )}
        {chunk.definitionEn && (
          <p className="mt-1 text-sm text-muted-foreground italic">
            {chunk.definitionEn}
          </p>
        )}
      </div>
      {examples.length > 0 && (
        <ul className="flex flex-col gap-2 border-t pt-3 text-sm">
          {examples.map((example, index) => (
            <li
              key={example.enId || example.en}
              className="flex items-start gap-1"
            >
              <div className="min-w-0 flex-1">
                <p>{example.en}</p>
                <p className="text-muted-foreground">{example.vi}</p>
                {example.enId && (
                  <a
                    href={tatoebaUrl(example.enId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Tatoeba #{example.enId}
                  </a>
                )}
              </div>
              <ListenButton
                text={example.en}
                audioUrl={index === 0 ? chunk.audioUrl : null}
              />
              <button
                type="button"
                title="Nói theo câu này"
                aria-label={`Nói theo: ${example.en}`}
                onClick={() => setShadow(example.en)}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Mic className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {shadow && (
        <ChunkShadow
          text={shadow}
          audioUrl={shadow === chunk.exampleEn ? chunk.audioUrl : null}
          onClose={() => setShadow(null)}
        />
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <SaveChunkButton target={{ chunkId: chunk.id }} saved={saved} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShadow(chunk.text)}
        >
          <Mic /> Nói theo
        </Button>
        {content && (
          <a
            href={content.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {content.source === 'open-english-wordnet'
              ? 'Open English WordNet'
              : content.sourceId && /^\d+$/.test(content.sourceId)
                ? `Tatoeba #${content.sourceId} · ${content.author}`
                : 'Tatoeba'}
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </article>
  )
}
