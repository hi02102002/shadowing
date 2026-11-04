/** Tab "Chunks" trong bài đọc / bài nghe / video: các chunk của kho (và của bạn) xuất hiện trong bài */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Blocks, Loader2, Mic } from 'lucide-react'

import {
  ChunkShadow,
  ListenButton,
  SaveChunkButton,
} from '#/components/chunk-actions'
import { Badge } from '#/components/ui/badge'
import { CHUNK_KIND_LABELS } from '#/lib/chunks'
import { detectChunks } from '#/server/fns/chunks'
import type { DetectedChunk } from '#/server/fns/chunks'

/** khoá cache ngắn gọn cho đoạn văn dài */
function hash(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++)
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
  return `${text.length}:${h}`
}

export function LessonChunks({
  text,
  onLocate,
  empty = 'Bài này chưa có chữ để tìm chunk.',
}: {
  text: string
  /** bấm vào chunk để tìm trong bài (bài đọc) */
  onLocate?: (surface: string) => void
  empty?: string
}) {
  const clean = text.replace(/\[\[|\]\]/g, '')
  const { data, isLoading, error } = useQuery({
    queryKey: ['lesson-chunks', hash(clean)],
    queryFn: () => detectChunks({ data: { text: clean.slice(0, 60_000) } }),
    enabled: !!clean.trim(),
    staleTime: 5 * 60_000,
  })

  if (!clean.trim())
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    )
  if (isLoading)
    return (
      <Loader2 className="mx-auto my-6 animate-spin text-muted-foreground" />
    )
  if (error) return <p className="text-sm text-destructive">{error.message}</p>
  if (!data?.length)
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Chưa thấy chunk nào của kho trong bài này.
      </p>
    )

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Blocks className="size-4" /> {data.length} chunk có trong bài ·{' '}
        <Link to="/chunks" className="underline">
          Kho Chunks
        </Link>
      </p>
      <ul className="flex flex-col gap-2">
        {data.map((chunk) => (
          <DetectedRow key={chunk.key} chunk={chunk} onLocate={onLocate} />
        ))}
      </ul>
    </div>
  )
}

function DetectedRow({
  chunk,
  onLocate,
}: {
  chunk: DetectedChunk
  onLocate?: (surface: string) => void
}) {
  const [shadow, setShadow] = useState<string | null>(null)
  const meaning = chunk.meaningVi ?? chunk.definitionEn
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={!onLocate}
              onClick={() => onLocate?.(chunk.surface)}
              className="text-base font-semibold enabled:hover:underline"
              title={onLocate ? 'Tìm trong bài' : undefined}
            >
              {chunk.text}
            </button>
            {chunk.surface.toLowerCase() !==
              chunk.text.replace(/\s*…$/, '').toLowerCase() && (
              <span className="text-xs text-muted-foreground">
                trong bài: “{chunk.surface}”
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {chunk.level && (
              <Badge className="h-5 px-1.5 text-[10px]">{chunk.level}</Badge>
            )}
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {CHUNK_KIND_LABELS[chunk.kind]}
            </Badge>
            {chunk.userChunkId && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                Của bạn
              </Badge>
            )}
          </div>
        </div>
        <ListenButton text={chunk.text} />
      </div>
      {meaning && (
        <p
          className={
            chunk.meaningVi
              ? 'text-muted-foreground'
              : 'text-muted-foreground italic'
          }
        >
          {meaning}
        </p>
      )}
      {chunk.exampleEn && chunk.exampleEn !== chunk.text && (
        <div className="flex items-start gap-1 border-t pt-2">
          <div className="min-w-0 flex-1">
            <p>{chunk.exampleEn}</p>
            {chunk.exampleVi && (
              <p className="text-muted-foreground">{chunk.exampleVi}</p>
            )}
          </div>
          <ListenButton text={chunk.exampleEn} audioUrl={chunk.audioUrl} />
        </div>
      )}
      {shadow && (
        <ChunkShadow
          text={shadow}
          audioUrl={chunk.audioUrl}
          onClose={() => setShadow(null)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <SaveChunkButton
          target={
            chunk.chunkId
              ? { chunkId: chunk.chunkId }
              : { userChunkId: chunk.userChunkId ?? 0 }
          }
          saved={chunk.saved}
        />
        <button
          type="button"
          onClick={() =>
            setShadow(
              chunk.exampleEn && chunk.exampleEn !== chunk.text
                ? chunk.exampleEn
                : chunk.text,
            )
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted"
        >
          <Mic className="size-4" /> Nói theo
        </button>
      </div>
    </li>
  )
}
