import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { Captions, Ear, Flame, Loader2, Mic, PenLine, Sparkles, Trash2, Youtube } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Progress } from '#/components/ui/progress'
import { parseYouTubeId } from '#/lib/youtube-id'
import { statsQuery, videosQuery } from '#/lib/queries'
import { formatDuration, relativeTime } from '#/lib/format'
import { deleteVideo, importVideo } from '#/server/fns/videos'
import type { VideoListItem } from '#/server/fns/videos'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(videosQuery()),
      context.queryClient.ensureQueryData(statsQuery()),
    ])
  },
  component: Home,
})

const CAPTION_LABEL: Record<string, string> = {
  manual: 'Phụ đề chuẩn',
  auto: 'Phụ đề tự động',
}

function Home() {
  const { data: videos } = useSuspenseQuery(videosQuery())
  const { data: stats } = useSuspenseQuery(statsQuery())

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <section className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Luyện nghe nói từ bất kỳ video YouTube</h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Dán link, app tự tách video thành từng câu để bạn <b>shadowing</b>, <b>nghe chép chính tả</b> và{' '}
            <b>luyện phát âm</b>. AI chỉ ra vì sao bạn nghe nhầm và cách sửa.
          </p>
        </div>
        <ImportForm />
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Ear className="size-4" /> Shadowing theo karaoke
          </span>
          <span className="flex items-center gap-1.5">
            <PenLine className="size-4" /> Chép chính tả + chấm từng từ
          </span>
          <span className="flex items-center gap-1.5">
            <Mic className="size-4" /> Chấm phát âm bằng giọng nói
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-4" /> AI giải thích bằng tiếng Việt
          </span>
        </div>
      </section>

      {(stats.dictationCount > 0 || stats.pronunciationCount > 0) && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<Flame className="size-4 text-rec" />} label="Chuỗi ngày" value={`${stats.streak} ngày`} />
          <Stat label="Bài chép chính tả" value={stats.dictationCount} sub={`TB ${stats.dictationAvg}%`} />
          <Stat label="Lượt luyện nói" value={stats.pronunciationCount} sub={`TB ${stats.pronunciationAvg}%`} />
          <Stat label="Lỗi trong sổ" value={stats.mistakeCount} href="/review" />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Thư viện của bạn</h2>
        {videos.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            Chưa có video nào. Dán một link YouTube ở trên để bắt đầu. Gợi ý: TED Talks, podcast, vlog có phụ đề tiếng Anh.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ImportForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (url: string) => importVideo({ data: { url } }),
    onSuccess: async ({ youtubeId }) => {
      await queryClient.invalidateQueries({ queryKey: videosQuery().queryKey })
      await navigate({ to: '/videos/$videoId', params: { videoId: youtubeId } })
    },
  })

  const form = useForm({
    defaultValues: { url: '' },
    onSubmit: ({ value }) => mutation.mutate(value.url.trim()),
  })

  return (
    <form
      className="flex w-full max-w-2xl flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field
        name="url"
        validators={{
          onChange: ({ value }) =>
            value.trim() && !parseYouTubeId(value) ? 'Link không đúng định dạng YouTube' : undefined,
          onSubmit: ({ value }) => (!parseYouTubeId(value) ? 'Hãy dán link YouTube hợp lệ' : undefined),
        }}
      >
        {(field) => (
          <>
            <div className="flex gap-2 rounded-xl border bg-card p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
              <Youtube className="ml-2 size-5 shrink-0 self-center text-rec" />
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="https://www.youtube.com/watch?v=…"
                className="border-0 shadow-none focus-visible:ring-0"
                disabled={mutation.isPending}
                aria-label="Link YouTube"
              />
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {mutation.isPending ? 'Đang xử lý…' : 'Bắt đầu học'}
              </Button>
            </div>
            {field.state.meta.errors.length > 0 && (
              <p className="text-left text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
            )}
          </>
        )}
      </form.Field>
      {mutation.isPending && (
        <p className="text-sm text-muted-foreground">
          Đang lấy phụ đề và tách câu… (chỉ hỗ trợ video có phụ đề tiếng Anh)
        </p>
      )}
      {mutation.error && <p className="text-left text-sm text-destructive">{mutation.error.message}</p>}
    </form>
  )
}

function VideoCard({ video }: { video: VideoListItem }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => deleteVideo({ data: { youtubeId: video.youtubeId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: videosQuery().queryKey }),
  })
  const pct = video.segmentCount ? Math.round((video.practicedCount / video.segmentCount) * 100) : 0

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <Link to="/videos/$videoId" params={{ videoId: video.youtubeId }} className="text-foreground no-underline">
        <div className="relative aspect-video bg-muted">
          {video.thumbnail && (
            <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
          )}
          {video.durationSec && (
            <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-xs text-white">
              {formatDuration(video.durationSec)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 p-3">
          <h3 className="line-clamp-2 font-medium leading-snug">{video.title}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{video.channel}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <Captions className="size-3.5" />
              {CAPTION_LABEL[video.captionSource] ?? video.captionSource}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={pct} className="h-1.5" />
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {video.practicedCount}/{video.segmentCount}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Thêm {relativeTime(video.createdAt)}</span>
        </div>
      </Link>
      <Button
        size="icon"
        variant="secondary"
        className="absolute right-2 top-2 size-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        aria-label="Xoá video"
        disabled={remove.isPending}
        onClick={() => {
          if (confirm(`Xoá "${video.title}" và toàn bộ lịch sử luyện tập?`)) remove.mutate()
        }}
      >
        <Trash2 />
      </Button>
    </li>
  )
}

function Stat({
  label,
  value,
  sub,
  icon,
  href,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: React.ReactNode
  href?: '/review'
}) {
  const body = (
    <div className="flex h-full flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-semibold">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
  return href ? (
    <Link to={href} className="text-foreground no-underline">
      {body}
    </Link>
  ) : (
    body
  )
}
