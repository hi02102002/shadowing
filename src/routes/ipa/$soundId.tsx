import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Ear,
  ListOrdered,
  Mic,
  Play,
  Snail,
  TriangleAlert,
  Volume2,
  XCircle,
} from 'lucide-react'

import { DiffLegend, DiffView } from '#/components/diff-view'
import {
  AccentSwitch,
  MarkedWord,
  useAccentSounds,
  useWordsIpa,
} from '#/components/ipa-shared'
import type { IpaMap } from '#/components/ipa-shared'
import { RecordButton } from '#/components/record-button'
import { ScoreRing } from '#/components/score-ring'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { useAccent } from '#/hooks/use-app-settings'
import { useRecorder } from '#/hooks/use-recorder'
import { IPA_DETAILS } from '#/lib/ipa-details'
import type { SoundDetail } from '#/lib/ipa-details'
import { exampleWord, GROUP_LABEL, IPA_SOUNDS } from '#/lib/ipa-sounds'
import type { IpaSound } from '#/lib/ipa-sounds'
import type { Accent } from '#/lib/speech'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { youtubeThumbnail } from '#/lib/youtube-id'
import { assessDrill } from '#/server/fns/pronunciation'
import type { DrillResult } from '#/server/fns/pronunciation'

export const Route = createFileRoute('/ipa/$soundId')({
  loader: ({ params }) => {
    const sound = IPA_SOUNDS.find((s) => s.id === params.soundId)
    const detail = IPA_DETAILS[params.soundId] as SoundDetail | undefined
    if (!sound || !detail) throw notFound()
    return { sound, detail }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `/${loaderData.sound.symbol.uk}/ · Luyện IPA`
          : 'Luyện IPA',
      },
    ],
  }),
  component: SoundPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Không có âm này</h1>
      <Link to="/ipa" className="mt-4 inline-block">
        ← Về bảng âm
      </Link>
    </div>
  ),
})

const soundById = new Map(IPA_SOUNDS.map((s) => [s.id, s]))

/** mọi từ trên trang (từ luyện tập + cặp tối thiểu) để phiên âm trong một lần gọi */
function pageWords(detail: SoundDetail) {
  return [
    ...new Set([
      ...detail.words.flatMap((g) => g.items.map(exampleWord)),
      ...detail.pairs.flatMap((p) => p.items.flat()),
    ]),
  ]
}

function SoundPage() {
  const { sound, detail } = Route.useLoaderData()
  const [accent] = useAccent()
  const sounds = useAccentSounds()
  const words = useMemo(() => pageWords(detail), [detail])
  const ipa = useWordsIpa(`sound:${sound.id}`, words)

  const at = sounds.findIndex((s) => s.id === sound.id)
  const prev = at > 0 ? sounds[at - 1] : undefined
  const next = at >= 0 && at < sounds.length - 1 ? sounds[at + 1] : undefined
  const sample = exampleWord(sound.examples[0])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <nav className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link
          to="/ipa"
          className="flex items-center gap-1 text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Bảng âm
        </Link>
        <div className="flex items-center gap-2">
          <AccentSwitch />
          <SoundNav sound={prev} accent={accent} dir="prev" />
          <SoundNav sound={next} accent={accent} dir="next" />
        </div>
      </nav>

      {sound.only && sound.only !== accent && (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <TriangleAlert className="size-4 shrink-0" />
          Âm này chỉ có trong giọng Anh. Đổi sang Giọng Anh để nghe đúng.
        </p>
      )}

      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card p-5">
        <span className="ipa text-6xl font-semibold text-primary">
          /{sound.symbol[accent]}/
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="text-sm text-muted-foreground">
            {GROUP_LABEL[sound.group]}
            {sound.symbol.uk !== sound.symbol.us && (
              <>
                {' '}
                · Anh <span className="ipa">/{sound.symbol.uk}/</span>, Mỹ{' '}
                <span className="ipa">/{sound.symbol.us}/</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {detail.traits.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => speak(sample, { accent })}>
            <Volume2 /> {sample}
          </Button>
          <Button
            variant="outline"
            onClick={() => speak(sample, { accent, rate: 0.6 })}
            aria-label="Nghe chậm"
          >
            <Snail />
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section icon={ListOrdered} title="Cách phát âm">
            <ol className="flex flex-col gap-2">
              {detail.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
              💡 {sound.tip}
            </p>
          </Section>

          <Section icon={TriangleAlert} title="Lỗi người Việt hay mắc">
            <ul className="flex flex-col gap-3">
              {detail.mistakes.map((m) => (
                <li key={m.wrong} className="flex flex-col gap-1 text-sm">
                  <span className="flex gap-2">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    {m.wrong}
                  </span>
                  <span className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                    {m.fix}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={Volume2} title="Từ luyện tập">
            <div className="grid gap-4 sm:grid-cols-3">
              {detail.words.map((g) => (
                <div key={g.label}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </h3>
                  <ul className="flex flex-col">
                    {g.items.map((ex) => (
                      <li key={ex}>
                        <WordButton
                          example={ex}
                          accent={accent}
                          ipa={ipa?.get(exampleWord(ex))}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {detail.pairs.length > 0 && (
            <Section icon={Ear} title="Cặp âm dễ nhầm">
              <MinimalPairs
                sound={sound}
                detail={detail}
                accent={accent}
                ipa={ipa}
              />
            </Section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <VideoCard id={detail.video} />
          <Section icon={Mic} title="Ghi âm và chấm">
            <RecordDrill key={sound.id} detail={detail} accent={accent} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function SoundNav({
  sound,
  accent,
  dir,
}: {
  sound: IpaSound | undefined
  accent: Accent
  dir: 'prev' | 'next'
}) {
  if (!sound) return null
  return (
    <Link
      to="/ipa/$soundId"
      params={{ soundId: sound.id }}
      className="flex items-center gap-1 rounded-md border px-2 py-1 text-foreground no-underline hover:bg-muted"
      aria-label={dir === 'prev' ? 'Âm trước' : 'Âm sau'}
    >
      {dir === 'prev' && <ChevronLeft className="size-4" />}
      <span className="ipa">/{sound.symbol[accent]}/</span>
      {dir === 'next' && <ChevronRight className="size-4" />}
    </Link>
  )
}

function WordButton({
  example,
  accent,
  ipa,
}: {
  example: string
  accent: Accent
  ipa: string | null | undefined
}) {
  return (
    <button
      type="button"
      onClick={() => speak(exampleWord(example), { accent })}
      className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted"
    >
      <MarkedWord example={example} />
      {ipa && (
        <span className="ipa truncate text-xs text-muted-foreground">
          /{ipa}/
        </span>
      )}
    </button>
  )
}

/** "với /ɪ/" khi `with` là một âm, ngược lại hiện nguyên nhãn (vd. "không có /h/") */
function PairLabel({ id, accent }: { id: string; accent: Accent }) {
  const other = soundById.get(id)
  if (!other) return <span>{id}</span>
  return (
    <Link
      to="/ipa/$soundId"
      params={{ soundId: other.id }}
      className="ipa font-semibold"
    >
      /{other.symbol[accent]}/
    </Link>
  )
}

function MinimalPairs({
  sound,
  detail,
  accent,
  ipa,
}: {
  sound: IpaSound
  detail: SoundDetail
  accent: Accent
  ipa: IpaMap
}) {
  // âm bên kia chỉ có ở giọng khác (vd. /ɒ/ khi đang học giọng Mỹ) → bỏ cặp đó
  const sets = detail.pairs.filter((p) => {
    const other = soundById.get(p.with)
    return !other?.only || other.only === accent
  })
  if (!sets.length)
    return (
      <p className="text-sm text-muted-foreground">
        Các cặp của âm này chỉ có ở giọng Anh.
      </p>
    )

  return (
    <div className="flex flex-col gap-5">
      {sets.map((set) => (
        <div key={set.with}>
          <h3 className="mb-2 text-sm text-muted-foreground">
            <span className="ipa font-semibold text-foreground">
              /{sound.symbol[accent]}/
            </span>{' '}
            với <PairLabel id={set.with} accent={accent} />
          </h3>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {set.items.map(([a, b]) => (
              <div
                key={a + b}
                className="grid grid-cols-2 overflow-hidden rounded-lg border"
              >
                {[a, b].map((w, i) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => speak(w, { accent })}
                    className={cn(
                      'flex flex-col items-start px-3 py-1.5 text-left hover:bg-muted',
                      i === 0 && 'border-r bg-primary/5',
                    )}
                  >
                    <span className="font-medium">{w}</span>
                    <span className="ipa text-xs text-muted-foreground">
                      {ipa?.get(w) ? `/${ipa.get(w)}/` : ' '}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
      <PairQuiz
        key={sets.map((s) => s.with).join()}
        pairs={sets.flatMap((s) => s.items)}
        accent={accent}
      />
    </div>
  )
}

/** Nghe một từ trong cặp, đoán là từ nào */
function PairQuiz({
  pairs,
  accent,
}: {
  pairs: Array<[string, string]>
  accent: Accent
}) {
  const [q, setQ] = useState<{ pair: [string, string]; answer: string } | null>(
    null,
  )
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })

  const ask = () => {
    let pair = pairs[Math.floor(Math.random() * pairs.length)]
    // tránh lặp lại đúng cặp vừa hỏi
    if (pairs.length > 1 && q && pair === q.pair)
      pair = pairs[(pairs.indexOf(pair) + 1) % pairs.length]
    const answer = pair[Math.random() < 0.5 ? 0 : 1]
    setQ({ pair, answer })
    setPicked(null)
    speak(answer, { accent })
  }

  const choose = (w: string) => {
    if (!q || picked) return
    setPicked(w)
    setScore((s) => ({
      right: s.right + (w === q.answer ? 1 : 0),
      total: s.total + 1,
    }))
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-4">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="font-medium">Kiểm tra tai: bạn nghe thấy từ nào?</span>
        <span className="text-muted-foreground">
          {score.right}/{score.total}
        </span>
      </div>
      {!q ? (
        <Button onClick={ask}>
          <Play /> Bắt đầu
        </Button>
      ) : (
        <>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => speak(q.answer, { accent })}
            >
              <Volume2 /> Nghe lại
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => speak(q.answer, { accent, rate: 0.6 })}
            >
              <Snail /> Chậm
            </Button>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
            {q.pair.map((w) => (
              <button
                key={w}
                type="button"
                disabled={!!picked}
                onClick={() => choose(w)}
                className={cn(
                  'rounded-lg border bg-card py-3 text-lg font-medium transition-colors enabled:hover:border-primary/60',
                  picked &&
                    w === q.answer &&
                    'border-green-600 bg-green-600/10 text-green-700 dark:text-green-400',
                  picked === w &&
                    w !== q.answer &&
                    'border-destructive bg-destructive/10 text-destructive',
                )}
              >
                {w}
              </button>
            ))}
          </div>
          {picked && (
            <Button size="sm" onClick={ask}>
              Câu tiếp <ChevronRight />
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function VideoCard({ id }: { id: string }) {
  const [playing, setPlaying] = useState(false)
  // sang âm khác → hiện lại ảnh bìa thay vì tự phát video mới
  useEffect(() => setPlaying(false), [id])
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe
            className="absolute inset-0 size-full"
            src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`}
            title="Video hướng dẫn phát âm"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0"
            aria-label="Phát video"
          >
            <img
              src={youtubeThumbnail(id)}
              alt=""
              className="size-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <Play className="size-6 fill-current" />
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="px-4 py-2 text-xs text-muted-foreground">
        Video BBC Learning English (giọng Anh)
      </p>
    </section>
  )
}

/** bỏ dấu câu và chữ hoa để "Peas." khớp "peas" */
const normalizeWord = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')

function RecordDrill({
  detail,
  accent,
}: {
  detail: SoundDetail
  accent: Accent
}) {
  // câu luyện + từng nhóm từ đọc liền nhau (máy nhận dạng từ đơn lẻ kém chính xác)
  const targets = useMemo(
    () => [
      ...detail.phrases,
      ...detail.words.map((g) => g.items.map(exampleWord).join(', ')),
    ],
    [detail],
  )
  const [text, setText] = useState(targets[0])
  const [result, setResult] = useState<DrillResult | null>(null)

  // phiên âm từng từ của câu đang luyện, hiện dưới kết quả chấm
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text])
  const ipa = useWordsIpa(`drill:${text}`, words)
  const ipaOf = useMemo(() => {
    const byWord = new Map<string, string | null>()
    ipa?.forEach((v, w) => byWord.set(normalizeWord(w), v))
    return (w: string) => byWord.get(normalizeWord(w))
  }, [ipa])

  const assess = useMutation({
    mutationFn: (blob: Blob) => {
      const form = new FormData()
      form.set('text', text)
      form.set(
        'audio',
        new File([blob], `rec.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`, {
          type: blob.type,
        }),
      )
      return assessDrill({ data: form })
    },
    onSuccess: setResult,
  })

  // bản ghi gần nhất để nghe lại giọng mình, so với giọng mẫu
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  useEffect(
    () => () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl)
    },
    [recordingUrl],
  )
  const playRecording = () => {
    if (recordingUrl) void new Audio(recordingUrl).play()
  }

  const recorder = useRecorder({
    maxMs: 20_000,
    onStop: (blob) => {
      // bản ghi quá ngắn thường là bấm nhầm
      if (blob.size <= 2_000) return
      setRecordingUrl(URL.createObjectURL(blob))
      assess.mutate(blob)
    },
  })

  const pick = (t: string) => {
    setText(t)
    setResult(null)
    setRecordingUrl(null)
    assess.reset()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {targets.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => pick(t)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              t === text
                ? 'border-primary bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {i < detail.phrases.length
              ? `Câu ${i + 1}`
              : detail.words[i - detail.phrases.length].label}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3">
        <p className="flex-1 text-lg font-medium">{text}</p>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => speak(text, { accent })}
          aria-label="Nghe mẫu"
        >
          <Volume2 />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <RecordButton
          recording={recorder.recording}
          busy={assess.isPending}
          level={recorder.level}
          elapsedMs={recorder.elapsedMs}
          onStart={() => {
            setResult(null)
            void recorder.start()
          }}
          onStop={recorder.stop}
        />
        {recorder.error && (
          <p className="text-sm text-destructive">{recorder.error}</p>
        )}
        {assess.error && (
          <p className="text-center text-sm text-destructive">
            {assess.error.message}
          </p>
        )}
      </div>

      {result && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-4">
            <ScoreRing value={result.accuracy} label="Chính xác" />
            <div className="min-w-0 flex-1">
              <DiffView tokens={result.tokens} ipa={ipaOf} className="text-base" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={playRecording} disabled={!recordingUrl}>
              <Mic /> Nghe lại giọng bạn
            </Button>
            <Button size="sm" variant="outline" onClick={() => speak(text, { accent })}>
              <Volume2 /> Nghe mẫu
            </Button>
          </div>
          <DiffLegend />
          <p className="text-sm">
            <span className="text-muted-foreground">Máy nghe được: </span>
            <span className="italic">
              “{result.transcript || '(không nhận dạng được)'}”
            </span>
          </p>
          {result.feedback && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <p>{result.feedback.summary}</p>
              {result.feedback.mistakes.map((m) => (
                <div key={m.word + m.heard}>
                  <span className="font-medium">{m.word}</span>{' '}
                  <span className="ipa text-muted-foreground">{m.ipa}</span>
                  <p className="text-muted-foreground">
                    {m.explanation} {m.tip}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
