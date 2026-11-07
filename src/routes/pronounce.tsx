import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-store'
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RotateCcw,
  Search,
  Volume2,
} from 'lucide-react'
import { z } from 'zod'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { YouTubePlayer } from '#/components/youtube-player'
import { useAccent } from '#/hooks/use-app-settings'
import { useStopSpeechOnLeave } from '#/hooks/use-stop-speech'
import { phraseTokens } from '#/lib/clip-match'
import { playerActions, playerStore } from '#/lib/player-store'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { searchLibraryClips, searchWebClips } from '#/server/fns/clips'
import type { Clip } from '#/server/fns/clips'

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/pronounce')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Nghe từ trong video · Shadowing' }] }),
  component: PronouncePage,
})

const validPhrase = (q: string) => {
  const n = phraseTokens(q).length
  return q.length <= 60 && n >= 1 && n <= 6
}

function PronouncePage() {
  const { q = '' } = Route.useSearch()
  const navigate = useNavigate({ from: '/pronounce' })
  const [draft, setDraft] = useState(q)
  useEffect(() => setDraft(q), [q])
  useStopSpeechOnLeave()

  const phrase = q.trim()
  const enabled = !!phrase && validPhrase(phrase)
  const library = useQuery({
    queryKey: ['clips', 'library', phrase],
    queryFn: () => searchLibraryClips({ data: { phrase } }),
    enabled,
    staleTime: Infinity,
  })
  const web = useQuery({
    queryKey: ['clips', 'web', phrase],
    queryFn: () => searchWebClips({ data: { phrase } }),
    enabled,
    staleTime: Infinity,
    retry: false,
  })
  const clips = useMemo(
    () => [...(library.data ?? []), ...(web.data ?? [])],
    [library.data, web.data],
  )

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <AudioLines className="size-6 text-primary" />
          Nghe từ trong video
        </h1>
        <p className="text-sm text-muted-foreground">
          Nghe người thật nói một từ hoặc cụm từ trong video YouTube: tìm trong
          thư viện của bạn trước, rồi tìm thêm trên YouTube.
        </p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const next = draft.trim()
          if (next) void navigate({ search: { q: next } })
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Từ hoặc cụm từ tiếng Anh, vd: plenty of"
          maxLength={60}
          autoFocus={!q}
          className="flex-1"
        />
        <Button type="submit" disabled={!draft.trim()}>
          <Search /> Tìm
        </Button>
      </form>

      {phrase && !enabled && (
        <p className="text-sm text-destructive">
          Nhập 1-6 từ tiếng Anh (tối đa 60 ký tự).
        </p>
      )}
      {enabled && (
        <ClipViewer
          key={phrase}
          phrase={phrase}
          clips={clips}
          libraryLoading={library.isPending}
          webLoading={web.isFetching}
          webError={web.isError}
        />
      )}
    </div>
  )
}

function ClipViewer({
  phrase,
  clips,
  libraryLoading,
  webLoading,
  webError,
}: {
  phrase: string
  clips: Clip[]
  libraryLoading: boolean
  webLoading: boolean
  webError: boolean
}) {
  const [accent] = useAccent()
  const [index, setIndex] = useState(0)
  const clip = clips[Math.min(index, clips.length - 1)] as Clip | undefined
  const ready = useSelector(playerStore, (s) => s.ready)
  const rate = useSelector(playerStore, (s) => s.rate)

  const replay = () => clip && playerActions.playRange(clip.startMs, clip.endMs)

  // player sẵn sàng (hoặc đổi clip trong cùng video) → phát đoạn có cụm từ
  useEffect(() => {
    if (ready && clip) playerActions.playRange(clip.startMs, clip.endMs)
  }, [ready, clip])

  const go = (d: number) =>
    setIndex((i) => Math.max(0, Math.min(clips.length - 1, i + d)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key.toLowerCase() === 'r') replay()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (libraryLoading && !clips.length)
    return <Status>Đang tìm trong thư viện…</Status>

  if (!clip) {
    if (webLoading)
      return (
        <Status>
          Đang tìm trên YouTube và đọc phụ đề từng video… (lần đầu mất khoảng
          10-25 giây)
        </Status>
      )
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-5">
        <p className="font-medium">Chưa tìm thấy video nào nói “{phrase}”.</p>
        <p className="text-sm text-muted-foreground">
          {webError
            ? 'Tìm trên YouTube bị lỗi (yt-dlp hoặc mạng). Bạn có thể thử lại sau.'
            : 'Thử cụm ngắn hơn, hoặc nhập thêm video vào thư viện.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => speak(phrase, { accent })}>
            <Volume2 /> Nghe giọng chuẩn
          </Button>
          <Button variant="outline" asChild>
            <a
              href={youglishUrl(phrase, accent)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink /> Mở YouGlish
            </a>
          </Button>
        </div>
      </section>
    )
  }

  const pos = clips.indexOf(clip)
  const [hFrom, hTo] = clip.highlight

  return (
    <section className="flex flex-col gap-3">
      <YouTubePlayer
        videoId={clip.youtubeId}
        className="overflow-hidden rounded-xl"
      />

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <p className="text-lg leading-relaxed">
          {clip.sentence.slice(0, hFrom)}
          <mark className="rounded bg-primary/15 px-0.5 font-semibold text-primary">
            {clip.sentence.slice(hFrom, hTo)}
          </mark>
          {clip.sentence.slice(hTo)}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => go(-1)}
            disabled={pos === 0}
            aria-label="Clip trước"
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-14 text-center text-sm tabular-nums">
            {pos + 1} / {clips.length}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => go(1)}
            disabled={pos === clips.length - 1}
            aria-label="Clip sau"
          >
            <ChevronRight />
          </Button>
          <Button size="sm" variant="outline" onClick={replay}>
            <RotateCcw /> Nghe lại
          </Button>
          <div
            className="flex rounded-md border p-0.5"
            role="group"
            aria-label="Tốc độ"
          >
            {[0.75, 1].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={rate === r}
                onClick={() => playerActions.setRate(r)}
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-medium',
                  rate === r
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {r}×
              </button>
            ))}
          </div>
          {webLoading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Đang tìm thêm trên
              YouTube…
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={clip.source === 'library' ? 'default' : 'secondary'}>
            {clip.source === 'library' ? 'Thư viện' : 'YouTube'}
          </Badge>
          <span className="min-w-0 truncate">
            {clip.title}
            {clip.channel && ` · ${clip.channel}`}
          </span>
          {clip.source === 'library' ? (
            <Link
              to="/videos/$videoId"
              params={{ videoId: clip.youtubeId }}
              search={{ seg: clip.segIdx }}
              className="ml-auto shrink-0"
            >
              Luyện video này
            </Link>
          ) : (
            <a
              href={`https://www.youtube.com/watch?v=${clip.youtubeId}&t=${Math.floor(clip.startMs / 1000)}s`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto shrink-0"
            >
              Mở trên YouTube
            </a>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Phím tắt: ← → đổi clip, R nghe lại.
        </p>
      </div>
    </section>
  )
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {children}
    </div>
  )
}

const youglishUrl = (phrase: string, accent: 'uk' | 'us') =>
  `https://youglish.com/pronounce/${encodeURIComponent(phrase)}/english/${accent}`
