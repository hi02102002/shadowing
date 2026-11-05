import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import {
  Blocks,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileUp,
  Loader2,
  Mic,
  RotateCcw,
  Search,
  Sparkles,
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
import type { ChunkLevel, ChunkSeed } from '#/lib/chunks'
import { chunksQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { generateTopicChunks } from '#/server/fns/chunks'

const searchSchema = z.object({
  level: z.enum(CHUNK_LEVELS).optional().catch(undefined),
  topic: z.enum(CHUNK_TOPICS).optional().catch(undefined),
  kind: z.enum(CHUNK_KINDS).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  autoGen: z.enum(['1', '0']).optional().catch(undefined),
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
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(chunksQuery(search))

  const patchSearch = (patch: Partial<typeof search>) =>
    void navigate({
      search: (previous) => ({ ...previous, ...patch, page: 1 }),
    })

  const generateMutation = useMutation({
    mutationFn: (variables: {
      topic: string
      level: ChunkLevel
      forceRegenerate?: boolean
    }) => generateTopicChunks({ data: variables }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chunks'] })
      void queryClient.invalidateQueries({ queryKey: ['user-chunks'] })
      void queryClient.invalidateQueries({ queryKey: ['user-chunk-imports'] })
    },
  })

  useEffect(() => {
    if (
      search.autoGen === '1' &&
      search.q &&
      !data.aiTopic &&
      !generateMutation.isPending
    ) {
      generateMutation.mutate(
        { topic: search.q, level: search.level ?? 'B1' },
        {
          onSettled: () => {
            void navigate({
              search: (prev) => ({ ...prev, autoGen: undefined }),
              replace: true,
            })
          },
        },
      )
    }
  }, [
    search.autoGen,
    search.q,
    search.level,
    data.aiTopic,
    generateMutation,
    navigate,
  ])

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
            offline. Kho không đặt giới hạn số lượng và có thể dùng AI biên soạn
            chunks theo mọi chủ đề. Bấm loa để nghe, micro để nói theo và chấm
            phát âm.
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
            placeholder="Tìm cụm tiếng Anh, chủ đề hoặc nghĩa tiếng Việt…"
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

      {/* Trạng thái đang tạo chunks bằng AI */}
      {generateMutation.isPending && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
          <Loader2 className="size-5 shrink-0 animate-spin" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">
              Đang dùng AI tạo 10 chunks giao tiếp thực tế…
            </span>
            <span className="text-xs opacity-90">
              Chủ đề: &ldquo;{search.q}&rdquo; ({search.level ?? 'B1'})
            </span>
          </div>
        </div>
      )}

      {/* Bảng chunks do AI biên soạn theo chủ đề */}
      {data.aiTopic && (
        <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="text-base font-semibold">
                10 Chunks AI biên soạn cho chủ đề &ldquo;{data.aiTopic.topic}&rdquo; (
                {data.aiTopic.level})
              </h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={generateMutation.isPending}
              onClick={() =>
                generateMutation.mutate({
                  topic: data.aiTopic!.topic,
                  level: data.aiTopic!.level,
                  forceRegenerate: true,
                })
              }
            >
              {generateMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              Tạo lại bằng AI
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.aiTopic.items.map((row) => (
              <AiChunkCard
                key={row.id}
                row={row}
                onRefresh={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ['chunks'],
                  })
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Nếu đang tìm kiếm một chủ đề nhưng chưa có AI chunks, cho phép tạo bằng AI */}
      {!data.aiTopic && search.q && !generateMutation.isPending && data.items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-primary/40 bg-card p-3 text-sm">
          <span className="text-muted-foreground">
            Bạn cần cụm từ giao tiếp sát thực tế cho chủ đề &ldquo;
            <b>{search.q}</b>&rdquo;?
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              generateMutation.mutate({
                topic: search.q!,
                level: search.level ?? 'B1',
              })
            }
          >
            <Sparkles className="size-3.5 text-primary" /> Tạo 10 chunks bằng AI
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {data.total} chunk trong kho có sẵn
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
      ) : !data.aiTopic && !generateMutation.isPending ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/40 bg-card p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-6" />
          </div>
          <h3 className="text-lg font-semibold">
            {search.q
              ? `Chưa có chunk trong kho có sẵn khớp "${search.q}"`
              : 'Không có chunk nào khớp bộ lọc'}
          </h3>
          <p className="max-w-md text-sm text-muted-foreground">
            {search.q
              ? `Kho offline chưa có cụm từ chính xác này. Bạn có thể để AI tạo ngay 10 cụm từ, khung câu và collocation cho chủ đề "${search.q}" ở cấp độ ${search.level ?? 'B1'}.`
              : 'Hãy thử đổi từ khoá hoặc điều chỉnh cấp độ / chủ đề.'}
          </p>
          {search.q && (
            <Button
              onClick={() =>
                generateMutation.mutate({
                  topic: search.q!,
                  level: search.level ?? 'B1',
                })
              }
            >
              <Sparkles className="size-4" />
              Tạo 10 chunks theo chủ đề này bằng AI
            </Button>
          )}
        </div>
      ) : null}

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

function AiChunkCard({
  row,
  onRefresh: _onRefresh,
}: {
  row: {
    id: number
    text: string
    meaningVi: string | null
    exampleEn: string | null
    kind: string
    saved: boolean
  }
  onRefresh: () => void
}) {
  const [shadow, setShadow] = useState<string | null>(null)
  const lines = row.exampleEn?.split('\n') ?? []
  const exEn = lines[0]?.trim() || null
  const exVi = lines[1]?.trim() || null

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-primary/25 bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="border-primary/40 text-primary">
          {(CHUNK_KIND_LABELS as Partial<Record<string, string>>)[row.kind] ??
            row.kind}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          AI biên soạn
        </Badge>
      </div>
      <div className="min-w-0">
        <div className="flex items-start gap-1">
          <h2 className="flex-1 text-lg font-semibold leading-snug">
            {row.text}
          </h2>
          <ListenButton text={row.text} />
        </div>
        {row.meaningVi && (
          <p className="mt-1 text-sm text-muted-foreground">{row.meaningVi}</p>
        )}
      </div>

      {exEn && (
        <div className="flex items-start gap-1 border-t pt-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <p>{exEn}</p>
            {exVi && (
              <p className="mt-0.5 text-xs text-muted-foreground">{exVi}</p>
            )}
          </div>
          <ListenButton text={exEn} />
          <button
            type="button"
            title="Nói theo câu này"
            aria-label={`Nói theo: ${exEn}`}
            onClick={() => setShadow(exEn)}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Mic className="size-4" />
          </button>
        </div>
      )}

      {shadow && (
        <ChunkShadow text={shadow} onClose={() => setShadow(null)} />
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <SaveChunkButton target={{ userChunkId: row.id }} saved={row.saved} />
        <Button size="sm" variant="outline" onClick={() => setShadow(row.text)}>
          <Mic /> Nói theo
        </Button>
      </div>
    </article>
  )
}
