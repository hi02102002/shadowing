import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mic,
  RotateCcw,
  SkipForward,
  Square,
  Trash2,
  Volume2,
  XCircle,
  Zap,
} from 'lucide-react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Progress } from '#/components/ui/progress'
import { useAccent } from '#/hooks/use-app-settings'
import { useRecorder } from '#/hooks/use-recorder'
import {
  MAX_ANSWER_SECONDS,
  MIN_ANSWER_SECONDS,
  REFLEX_COUNTS,
  REFLEX_LEVELS,
  REFLEX_MODES,
  REFLEX_MODE_INFO,
  REFLEX_SOURCE_INFO,
  defaultAnswerSeconds,
  modeLabel,
  sourceLabel,
  sourcesFor,
} from '#/lib/reflex'
import type { ReflexLevel, ReflexMode, ReflexSource } from '#/lib/reflex'
import {
  reflexSessionQuery,
  reflexSessionsQuery,
  reflexTopicsQuery,
  statsQuery,
} from '#/lib/queries'
import { speak, speakAndWait } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { mistakeLabel } from '#/server/ai/prompts'
import {
  deleteReflexSession,
  finishReflexSession,
  skipReflexItem,
  startReflexSession,
  submitReflexAnswer,
} from '#/server/fns/reflex'
import type { ReflexItemRow, ReflexSessionDetail } from '#/server/fns/reflex'

const searchSchema = z.object({
  id: z.number().int().optional().catch(undefined),
})

export const Route = createFileRoute('/reflex')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Phản xạ · Shadowing' }] }),
  component: ReflexPage,
})

/** mức âm lượng coi là đã bắt đầu nói (để đo thời gian phản xạ) */
const VOICE_LEVEL = 0.18
/** bản ghi nhỏ hơn thế coi như không nói gì */
const MIN_BLOB_BYTES = 2000

function ReflexPage() {
  const { id } = Route.useSearch()
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      {id ? <SessionView key={id} id={id} /> : <Setup />}
    </div>
  )
}

function Chip({
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
          ? 'border-primary bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function Setup() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<ReflexMode>('translate')
  const [source, setSource] = useState<ReflexSource>('bank')
  const [level, setLevel] = useState<ReflexLevel>('A2')
  const [count, setCount] = useState<number>(10)
  const [seconds, setSeconds] = useState<number | null>(null)
  const [topic, setTopic] = useState('')
  const { data: history = [] } = useQuery(reflexSessionsQuery())
  const topics = useQuery({
    ...reflexTopicsQuery(),
    enabled: source === 'iteslj',
  })

  const answerSeconds = seconds ?? defaultAnswerSeconds(mode, level)

  const chooseMode = (m: ReflexMode) => {
    setMode(m)
    if (!sourcesFor(m).includes(source)) setSource('bank')
    setTopic('')
  }

  const start = useMutation({
    mutationFn: () =>
      startReflexSession({
        data: {
          mode,
          source,
          level,
          count,
          answerSeconds,
          topic:
            source === 'ai' || source === 'iteslj'
              ? topic.trim() || undefined
              : undefined,
        },
      }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({
        queryKey: reflexSessionsQuery().queryKey,
      })
      void navigate({ to: '/reflex', search: { id } })
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteReflexSession({ data: { id } }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: reflexSessionsQuery().queryKey,
      }),
  })

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Zap className="size-6 text-primary" /> Luyện phản xạ
        </h1>
        <p className="text-sm text-muted-foreground">
          Đề hiện ra là micro bật ngay: nói tiếng Anh trong vài giây, không kịp
          dịch trong đầu. AI chấm từng câu, đo thời gian bạn bắt đầu nói và gợi
          ý câu tự nhiên hơn.
        </p>
      </header>

      <form
        className="flex flex-col gap-5 rounded-xl border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault()
          start.mutate()
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {REFLEX_MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => chooseMode(m)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                mode === m ? 'border-primary bg-primary/5' : 'hover:bg-muted',
              )}
            >
              <span className="block font-medium">
                {REFLEX_MODE_INFO[m].label}
              </span>
              <span className="text-xs text-muted-foreground">
                {REFLEX_MODE_INFO[m].detail}
              </span>
            </button>
          ))}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Nguồn đề</legend>
          <div className="flex flex-wrap gap-2">
            {sourcesFor(mode).map((s) => (
              <Chip
                key={s}
                active={source === s}
                onClick={() => {
                  setSource(s)
                  setTopic('')
                }}
              >
                {REFLEX_SOURCE_INFO[s].label}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {REFLEX_SOURCE_INFO[source].detail}
          </p>
        </fieldset>

        {source === 'ai' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Chủ đề (không bắt buộc)
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={200}
              placeholder="Vd. đi siêu thị, phỏng vấn xin việc, du lịch Nhật Bản"
            />
          </label>
        )}
        {source === 'iteslj' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Chủ đề
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={topics.isLoading}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">
                {topics.isLoading
                  ? 'Đang tải chủ đề…'
                  : 'Ngẫu nhiên vài chủ đề'}
              </option>
              {topics.data?.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.title}
                </option>
              ))}
            </select>
            {topics.error && (
              <span className="text-xs text-destructive">
                {topics.error.message}
              </span>
            )}
          </label>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-20 font-medium">Trình độ</span>
          {REFLEX_LEVELS.map((l) => (
            <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
              {l}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-20 font-medium">Số câu</span>
          {REFLEX_COUNTS.map((n) => (
            <Chip key={n} active={count === n} onClick={() => setCount(n)}>
              {n}
            </Chip>
          ))}
        </div>
        <label className="flex flex-wrap items-center gap-3 text-sm">
          <span className="w-20 font-medium">Thời gian</span>
          <input
            type="range"
            min={MIN_ANSWER_SECONDS}
            max={MAX_ANSWER_SECONDS}
            value={answerSeconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            className="w-48 accent-primary"
          />
          <span className="font-mono">{answerSeconds} giây / câu</span>
          {seconds !== null && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setSeconds(null)}
            >
              mặc định
            </button>
          )}
        </label>

        {start.error && (
          <p role="alert" className="text-sm text-destructive">
            {start.error.message}
          </p>
        )}
        <Button type="submit" disabled={start.isPending}>
          {start.isPending ? <Loader2 className="animate-spin" /> : <Zap />} Bắt
          đầu luyện
        </Button>
      </form>

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Các buổi trước</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {history.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <Link
                  to="/reflex"
                  search={{ id: s.id }}
                  className="min-w-0 flex-1 truncate text-foreground no-underline hover:underline"
                >
                  {modeLabel(s.mode)}
                  {s.topic ? ` · ${s.topic}` : ''}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {s.level} · {s.done}/{s.total} câu
                  {s.avgScore != null ? ` · ${s.avgScore}/10` : ''} ·{' '}
                  {s.createdAt.toLocaleDateString('vi-VN')}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  title="Xoá buổi này"
                  onClick={() => remove.mutate(s.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

const isDone = (i: ReflexItemRow) => i.answeredAt != null || i.skipped

function SessionView({ id }: { id: number }) {
  const { data, isLoading, error } = useQuery(reflexSessionQuery(id))
  if (isLoading)
    return <Loader2 className="mx-auto animate-spin text-muted-foreground" />
  if (error || !data)
    return (
      <p role="alert" className="text-destructive">
        {error?.message ?? 'Không tìm thấy buổi luyện'}
      </p>
    )
  return <Practice session={data} />
}

type Phase =
  'ready' | 'prompting' | 'answering' | 'grading' | 'result' | 'silent'

function Practice({ session }: { session: ReflexSessionDetail }) {
  const queryClient = useQueryClient()
  const [accent] = useAccent()
  const items = session.items
  const firstPending = items.findIndex((i) => !isDone(i))
  const [index, setIndex] = useState(
    firstPending === -1 ? items.length : firstPending,
  )
  const [phase, setPhase] = useState<Phase>('ready')
  const item = items[index] as ReflexItemRow | undefined
  const mode = session.mode as ReflexMode

  const shownAt = useRef(0)
  const latencyRef = useRef<number | null>(null)
  const discardRef = useRef(false)
  const autoRef = useRef(false)

  const refresh = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: reflexSessionQuery(session.id).queryKey,
      }),
    [queryClient, session.id],
  )

  const submit = useMutation({
    mutationFn: (input: {
      itemId: number
      audio: Blob
      latencyMs: number | null
    }) => {
      const form = new FormData()
      form.set('itemId', String(input.itemId))
      form.set(
        'audio',
        new File(
          [input.audio],
          input.audio.type.includes('mp4') ? 'rec.m4a' : 'rec.webm',
          { type: input.audio.type },
        ),
      )
      if (input.latencyMs != null)
        form.set('latencyMs', String(Math.round(input.latencyMs)))
      return submitReflexAnswer({ data: form })
    },
    onSuccess: async () => {
      await refresh()
      setPhase('result')
      void queryClient.invalidateQueries({ queryKey: statsQuery().queryKey })
    },
    onError: () => setPhase('result'),
  })

  const recorder = useRecorder({
    maxMs: session.answerSeconds * 1000,
    onStop: (blob) => {
      if (discardRef.current) {
        discardRef.current = false
        return
      }
      if (!item) return
      // nói nhỏ thì meter có thể chưa vượt ngưỡng: vẫn gửi, server báo nếu không nghe được gì
      if (blob.size <= MIN_BLOB_BYTES) {
        setPhase('silent')
        return
      }
      setPhase('grading')
      submit.mutate({
        itemId: item.id,
        audio: blob,
        latencyMs: latencyRef.current,
      })
    },
  })

  // đo lúc bắt đầu có tiếng nói
  useEffect(() => {
    if (
      phase === 'answering' &&
      latencyRef.current == null &&
      recorder.level > VOICE_LEVEL
    )
      latencyRef.current = performance.now() - shownAt.current
  }, [phase, recorder.level])

  const begin = useCallback(async () => {
    if (!item) return
    submit.reset()
    latencyRef.current = null
    if (item.promptLang === 'en' && mode === 'qa') {
      setPhase('prompting')
      await speakAndWait(item.prompt, { accent })
    }
    shownAt.current = performance.now()
    setPhase('answering')
    await recorder.start()
  }, [item, mode, accent, recorder, submit])

  const goTo = useCallback(
    (next: number) => {
      recorder.reset()
      setIndex(next)
      setPhase(next < items.length ? 'ready' : 'result')
    },
    [items.length, recorder],
  )

  const nextPending = () => {
    const after = items.findIndex((i, n) => n > index && !isDone(i))
    return after === -1 ? items.length : after
  }

  const skip = useMutation({
    mutationFn: (itemId: number) => skipReflexItem({ data: { itemId } }),
    onSuccess: refresh,
  })

  const onSkip = () => {
    if (!item) return
    if (recorder.recording) {
      discardRef.current = true
      recorder.stop()
    }
    skip.mutate(item.id)
    autoRef.current = true
    goTo(nextPending())
  }

  // tự chuyển sang đề kế tiếp: sau "Câu tiếp" / "Bỏ qua" thì bắt đầu luôn, không cần bấm lại
  useEffect(() => {
    if (phase === 'ready' && autoRef.current && item) {
      autoRef.current = false
      void begin()
    }
  }, [phase, item, begin])

  const next = () => {
    autoRef.current = true
    goTo(nextPending())
  }

  // phím tắt: Enter/Space = bắt đầu / dừng / câu tiếp
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      if (phase === 'ready') void begin()
      else if (phase === 'answering') recorder.stop()
      else if (phase === 'result' && !submit.isError) next()
      else if (phase === 'silent' || (phase === 'result' && submit.isError))
        void begin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const finished = index >= items.length
  useEffect(() => {
    if (finished && !session.finishedAt)
      void finishReflexSession({ data: { id: session.id } }).then(() =>
        queryClient.invalidateQueries({
          queryKey: reflexSessionsQuery().queryKey,
        }),
      )
  }, [finished, session.finishedAt, session.id, queryClient])

  const doneCount = items.filter(isDone).length

  return (
    <>
      <header className="flex flex-col gap-3">
        <Link
          to="/reflex"
          search={{}}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Buổi mới
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">{modeLabel(mode)}</h1>
          <span className="text-sm text-muted-foreground">
            {session.level}
            {session.topic ? ` · ${session.topic}` : ''} ·{' '}
            {sourceLabel(session.source)}
          </span>
        </div>
        <Progress value={(doneCount / items.length) * 100} />
      </header>

      {finished || !item ? (
        <Summary session={session} />
      ) : (
        <section className="flex flex-col gap-5 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Câu {index + 1}/{items.length}
            </span>
            {(phase === 'ready' || phase === 'answering') && (
              <button
                type="button"
                onClick={onSkip}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <SkipForward className="size-3.5" /> Bỏ qua
              </button>
            )}
          </div>

          <PromptCard
            item={item}
            mode={mode}
            hidden={phase === 'ready'}
            accent={accent}
          />

          {phase === 'ready' && (
            <div className="flex flex-col items-center gap-2">
              <Button size="lg" onClick={() => void begin()}>
                <Mic /> Bắt đầu
              </Button>
              <span className="text-xs text-muted-foreground">
                Đề hiện ra là micro bật · {session.answerSeconds} giây · phím
                Enter
              </span>
            </div>
          )}
          {phase === 'prompting' && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Volume2 className="size-4 animate-pulse" /> Nghe câu hỏi…
            </p>
          )}
          {phase === 'answering' && (
            <Countdown
              recording={recorder.recording}
              elapsedMs={recorder.elapsedMs}
              totalMs={session.answerSeconds * 1000}
              level={recorder.level}
              onStop={recorder.stop}
              error={recorder.error}
            />
          )}
          {phase === 'grading' && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang nghe và chấm…
            </p>
          )}
          {phase === 'silent' && (
            <div className="flex flex-col items-center gap-3 text-sm">
              <p className="text-muted-foreground">
                Chưa nghe thấy bạn nói. Thử lại nhé, nói to và rõ hơn.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => void begin()}>
                  <RotateCcw /> Nói lại
                </Button>
                <Button variant="outline" onClick={onSkip}>
                  <SkipForward /> Bỏ qua
                </Button>
              </div>
            </div>
          )}
          {phase === 'result' &&
            (submit.isError ? (
              <div className="flex flex-col items-center gap-3 text-sm">
                <p role="alert" className="text-destructive">
                  {submit.error.message}
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => void begin()}>
                    <RotateCcw /> Nói lại
                  </Button>
                  <Button variant="outline" onClick={onSkip}>
                    <SkipForward /> Bỏ qua
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ItemResult item={item} accent={accent} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => void begin()}>
                    <RotateCcw /> Nói lại
                  </Button>
                  <Button onClick={next}>
                    {nextPending() < items.length ? 'Câu tiếp' : 'Xem tổng kết'}{' '}
                    <ArrowRight />
                  </Button>
                </div>
              </>
            ))}
        </section>
      )}
    </>
  )
}

function PromptCard({
  item,
  mode,
  hidden,
  accent,
}: {
  item: ReflexItemRow
  mode: ReflexMode
  hidden: boolean
  accent: ReturnType<typeof useAccent>[0]
}) {
  if (hidden)
    return (
      <div className="grid min-h-28 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Đề sẽ hiện khi bạn sẵn sàng
      </div>
    )
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/50 px-4 py-6 text-center">
      <p
        className={cn(
          'text-xl font-medium',
          item.promptLang === 'en' && 'font-serif',
        )}
      >
        {item.prompt}
      </p>
      {item.hint && (
        <p className="text-sm text-muted-foreground">
          {mode === 'pattern'
            ? 'Ghép: '
            : mode === 'qa'
              ? 'Chủ đề: '
              : 'Gợi ý: '}
          <span className="font-medium text-foreground">{item.hint}</span>
        </p>
      )}
      {item.promptLang === 'en' && (
        <button
          type="button"
          onClick={() => speak(item.prompt, { accent })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Volume2 className="size-3.5" /> Nghe lại
        </button>
      )}
    </div>
  )
}

function Countdown({
  recording,
  elapsedMs,
  totalMs,
  level,
  onStop,
  error,
}: {
  recording: boolean
  elapsedMs: number
  totalMs: number
  level: number
  onStop: () => void
  error: string | null
}) {
  if (error)
    return (
      <p role="alert" className="text-center text-sm text-destructive">
        {error}
      </p>
    )
  const left = Math.max(0, totalMs - elapsedMs)
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="font-mono text-4xl tabular-nums">
        {recording ? (left / 1000).toFixed(1) : '…'}
      </div>
      <Progress
        value={(left / totalMs) * 100}
        className={cn('h-1.5', left < 2000 && '[&>*]:bg-rec')}
      />
      <button
        type="button"
        onClick={onStop}
        disabled={!recording}
        aria-label="Nói xong"
        className="rec-pulse grid size-14 place-items-center rounded-full bg-rec text-white shadow-lg disabled:opacity-50"
        style={{
          boxShadow: `0 0 0 ${4 + level * 14}px color-mix(in oklab, var(--rec) 25%, transparent)`,
        }}
      >
        <Square className="size-5 fill-current" />
      </button>
      <span className="text-xs text-muted-foreground">
        Nói ngay! Bấm (hoặc Enter) khi nói xong
      </span>
    </div>
  )
}

const scoreTone = (s: number) =>
  s >= 8
    ? 'text-emerald-600 dark:text-emerald-400'
    : s >= 5
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-destructive'

function ItemResult({
  item,
  accent,
}: {
  item: ReflexItemRow
  accent: ReturnType<typeof useAccent>[0]
}) {
  const fb = item.feedback
  if (!fb) return null
  const sameAsBetter = (s?: string | null) =>
    !!s && s.trim().toLowerCase() === fb.better.trim().toLowerCase()
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-4">
        <span
          className={cn(
            'font-mono text-3xl font-semibold',
            scoreTone(fb.score),
          )}
        >
          {fb.score}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1">
            {fb.meaningOk ? (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="size-4 text-destructive" />
            )}
            {fb.meaningOk ? 'Đúng ý' : 'Chưa đúng ý'}
          </span>
          {item.latencyMs != null && (
            <span className="text-xs text-muted-foreground">
              Bắt đầu nói sau {(item.latencyMs / 1000).toFixed(1)} giây
            </span>
          )}
        </div>
      </div>
      <dl className="grid gap-2">
        <div>
          <dt className="text-xs text-muted-foreground">Bạn nói</dt>
          <dd>{item.transcript}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Nên nói</dt>
          <dd className="flex items-start gap-2 font-medium">
            {fb.better}
            <button
              type="button"
              title="Nghe"
              onClick={() => speak(fb.better, { accent })}
              className="text-muted-foreground hover:text-foreground"
            >
              <Volume2 className="size-4" />
            </button>
          </dd>
        </div>
        {item.reference && !sameAsBetter(item.reference) && (
          <div>
            <dt className="text-xs text-muted-foreground">Câu mẫu khác</dt>
            <dd className="flex items-start gap-2">
              {item.reference}
              <button
                type="button"
                title="Nghe"
                onClick={() => speak(item.reference ?? '', { accent })}
                className="text-muted-foreground hover:text-foreground"
              >
                <Volume2 className="size-4" />
              </button>
            </dd>
          </div>
        )}
      </dl>
      {fb.corrections.length > 0 && (
        <ul className="flex flex-col gap-2">
          {fb.corrections.map((c, i) => (
            <li key={i} className="rounded-lg border p-3">
              <p>
                <span className="text-destructive line-through">{c.said}</span>{' '}
                → <span className="font-medium">{c.better}</span>{' '}
                <span className="text-xs text-muted-foreground">
                  ({mistakeLabel(c.type)})
                </span>
              </p>
              <p className="text-muted-foreground">{c.explanation}</p>
            </li>
          ))}
        </ul>
      )}
      {fb.tip && <p className="text-muted-foreground">💡 {fb.tip}</p>}
      {item.attribution && (
        <p className="text-xs text-muted-foreground">
          Nguồn: {item.attribution}
        </p>
      )}
    </div>
  )
}

function Summary({ session }: { session: ReflexSessionDetail }) {
  const answered = session.items.filter((i) => i.score != null)
  const avg = answered.length
    ? answered.reduce((n, i) => n + (i.score ?? 0), 0) / answered.length
    : null
  const latencies = answered
    .map((i) => i.latencyMs)
    .filter((n): n is number => n != null)
  const avgLatency = latencies.length
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : null
  const weak = session.items.filter(
    (i) => i.skipped || (i.score != null && i.score < 7),
  )

  return (
    <section className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border bg-card p-4">
          <div
            className={cn(
              'font-mono text-2xl font-semibold',
              avg != null && scoreTone(avg),
            )}
          >
            {avg != null ? avg.toFixed(1) : '–'}
          </div>
          <div className="text-xs text-muted-foreground">điểm TB / 10</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="font-mono text-2xl font-semibold">
            {avgLatency != null ? `${(avgLatency / 1000).toFixed(1)}s` : '–'}
          </div>
          <div className="text-xs text-muted-foreground">phản xạ TB</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="font-mono text-2xl font-semibold">
            {answered.length}/{session.items.length}
          </div>
          <div className="text-xs text-muted-foreground">câu đã nói</div>
        </div>
      </div>

      {weak.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Câu cần luyện lại</h2>
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {weak.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 px-4 py-3">
                <span>{i.prompt}</span>
                <span className="font-medium">
                  {i.feedback?.better ?? i.reference ?? ''}
                </span>
                <span className="text-xs text-muted-foreground">
                  {i.skipped && i.score == null ? 'Đã bỏ qua' : `${i.score}/10`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button asChild className="w-fit">
        <Link to="/reflex" search={{}}>
          <Zap /> Luyện buổi mới
        </Link>
      </Button>
    </section>
  )
}
