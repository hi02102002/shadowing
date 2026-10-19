import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Ear, FileText, Mic, PenLine } from 'lucide-react'
import { z } from 'zod'

import { TranscriptList } from '#/components/transcript-list'
import { YouTubePlayer } from '#/components/youtube-player'
import { playerActions } from '#/lib/player-store'
import { videoQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'

const searchSchema = z.object({
  seg: z.number().int().min(0).optional().catch(undefined),
})

export const Route = createFileRoute('/videos/$videoId')({
  validateSearch: searchSchema,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(videoQuery(params.videoId)),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.video.title} · Shadowing`
          : 'Shadowing',
      },
    ],
  }),
  component: VideoLayout,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Không mở được video</h1>
      <p className="mt-2 text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Link to="/" className="mt-4 inline-block">
        ← Về thư viện
      </Link>
    </div>
  ),
})

const MODES = [
  { to: '/videos/$videoId', label: 'Transcript', icon: FileText, exact: true },
  { to: '/videos/$videoId/shadow', label: 'Shadowing', icon: Ear },
  { to: '/videos/$videoId/dictation', label: 'Chép chính tả', icon: PenLine },
  { to: '/videos/$videoId/pronounce', label: 'Phát âm', icon: Mic },
] as const

function VideoLayout() {
  const { videoId } = Route.useParams()
  const { seg } = Route.useSearch()
  const { data } = useSuspenseQuery(videoQuery(videoId))
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })
  const practiceMode = /\/(shadow|dictation|pronounce)$/.exec(pathname)?.[1]

  const onSelect = (idx: number) => {
    if (practiceMode) {
      void navigate({ to: '.', search: (p) => ({ ...p, seg: idx }) })
    } else {
      // chế độ transcript: phát tự do từ câu được chọn
      playerActions.clearRange()
      playerActions.seek(data.segments[idx].startMs)
      playerActions.play()
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <YouTubePlayer
          videoId={videoId}
          hideCaptions={practiceMode === 'dictation'}
        />
        <div>
          <h1 className="line-clamp-2 text-lg font-semibold leading-snug">
            {data.video.title}
          </h1>
          <p className="text-sm text-muted-foreground">{data.video.channel}</p>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/50 p-1"
          aria-label="Chế độ luyện tập"
        >
          {MODES.map(({ to, label, icon: Icon, ...rest }) => (
            <Link
              key={to}
              to={to}
              params={{ videoId }}
              search={{ seg }}
              activeOptions={{ exact: 'exact' in rest, includeSearch: false }}
              className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
              activeProps={{
                className: cn('bg-background text-foreground shadow-sm'),
              }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Outlet />
      </div>

      <aside className="flex min-h-0 flex-col rounded-xl border bg-card lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Transcript</h2>
          <span className="text-xs text-muted-foreground">
            {data.segments.length} câu
          </span>
        </div>
        <TranscriptList
          segments={data.segments}
          selectedIdx={practiceMode ? (seg ?? 0) : undefined}
          onSelect={onSelect}
          hideText={practiceMode === 'dictation'}
          className="h-80 flex-1 p-1 lg:h-auto"
        />
      </aside>
    </div>
  )
}
