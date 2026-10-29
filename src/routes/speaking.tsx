import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2, MessagesSquare, Mic, Presentation, RotateCcw, Shuffle, Square, Trash2, Volume2, X } from 'lucide-react'
import { z } from 'zod'

import { SpeakTabs } from '#/components/speak-tabs'
import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import { Textarea } from '#/components/ui/textarea'
import { useAccent } from '#/hooks/use-app-settings'
import { useRecorder } from '#/hooks/use-recorder'
import { IELTS_PART1, IELTS_PART3 } from '#/lib/conversation'
import type { TalkLevel } from '#/lib/conversation'
import { speak, speakLong } from '#/lib/speech'
import { CUSTOM_TOPIC, MAX_SPEAK_SECONDS, PREP_SECONDS, SPEAKING_TARGETS, SPEAKING_TARGET_LABEL, SPEAKING_TOPICS, parseCueCard } from '#/lib/speaking-topics'
import type { SpeakingTarget } from '#/lib/speaking-topics'
import { conversationsQuery, speakingAttemptQuery, speakingAttemptsQuery, statsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { mistakeLabel } from '#/server/ai/prompts'
import { startConversation } from '#/server/fns/conversation'
import { assessSpeaking, deleteSpeakingAttempt, submitSpeaking } from '#/server/fns/speaking'

const searchSchema = z.object({
  id: z.number().int().optional().catch(undefined),
})

export const Route = createFileRoute('/speaking')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Nói theo đề · Shadowing' }] }),
  component: SpeakingPage,
})

interface Topic {
  id: string
  title: string
  bullets: string[]
}

const TARGET_KEY = 'speaking-target'

/** band mục tiêu chọn lần trước, nhớ trong trình duyệt */
function useTarget() {
  const [target, setTarget] = useState<SpeakingTarget>('6')
  useEffect(() => {
    try {
      const v = localStorage.getItem(TARGET_KEY)
      if (SPEAKING_TARGETS.includes(v as SpeakingTarget)) setTarget(v as SpeakingTarget)
    } catch {
      /* private mode */
    }
  }, [])
  const change = (v: SpeakingTarget) => {
    setTarget(v)
    try {
      localStorage.setItem(TARGET_KEY, v)
    } catch {
      /* private mode */
    }
  }
  return [target, change] as const
}

const GROUPS = [...new Set(SPEAKING_TOPICS.map((t) => t.group))]

/** trình độ câu hỏi của giám khảo AI (Part 1 / Part 3) theo band mục tiêu */
const EXAM_LEVEL: Record<SpeakingTarget, TalkLevel> = { '5': 'A2', '6': 'B1', '7': 'B2' }

/** mở buổi Part 1 / Part 3 với AI giám khảo ở trang /talk */
function useExam() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (opts: { part: typeof IELTS_PART1 | typeof IELTS_PART3; target: SpeakingTarget; part2Title?: string }) =>
      startConversation({ data: { scenario: opts.part, level: EXAM_LEVEL[opts.target], custom: opts.part2Title } }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: conversationsQuery().queryKey })
      void navigate({ to: '/talk', search: { id } })
    },
  })
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

function SpeakingPage() {
  const { id } = Route.useSearch()
  const [topic, setTopic] = useState<(Topic & { target: SpeakingTarget }) | null>(null)
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      {topic ? (
        <Practice key={`${topic.id}:${topic.title}`} topic={topic} onCancel={() => setTopic(null)} onDone={() => setTopic(null)} />
      ) : id ? (
        <Result key={id} id={id} onRetry={setTopic} />
      ) : (
        <Picker onPick={setTopic} />
      )}
    </div>
  )
}

function Picker({ onPick: pick }: { onPick: (t: Topic & { target: SpeakingTarget }) => void }) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useTarget()
  const onPick = (t: Topic) => pick({ id: t.id, title: t.title, bullets: t.bullets, target })
  const [group, setGroup] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const { data: history = [] } = useQuery(speakingAttemptsQuery())
  const remove = useMutation({
    mutationFn: (id: number) => deleteSpeakingAttempt({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: speakingAttemptsQuery().queryKey }),
  })
  const exam = useExam()
  const custom = parseCueCard(pasted)
  const topics = group ? SPEAKING_TOPICS.filter((t) => t.group === group) : SPEAKING_TOPICS

  return (
    <>
      <header className="flex flex-col gap-3">
        <SpeakTabs />
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Presentation className="size-6 text-primary" /> Nói theo đề
        </h1>
        <p className="text-sm text-muted-foreground">
          Như IELTS Speaking Part 2: 1 phút chuẩn bị, nói tối đa 2 phút. AI ước lượng band, chỉ ra câu chưa đúng và viết bài mẫu từ ý của bạn.
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Mục tiêu</span>
          {SPEAKING_TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={target === t}
              onClick={() => setTarget(t)}
              className={cn(
                'rounded-full border px-3 py-1 transition-colors',
                target === t ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {SPEAKING_TARGET_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Điểm vẫn chấm như thi thật; mục tiêu chỉ đổi độ khó của bài mẫu, từ vựng gợi ý và lời khuyên.</p>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Part 1 · Hỏi đáp với giám khảo</h2>
          <p className="text-sm text-muted-foreground">AI hỏi về bản thân, nơi ở, sở thích như phòng thi; kết thúc để xem band và câu nên sửa.</p>
          {exam.error && <p className="mt-1 text-sm text-destructive">{exam.error.message}</p>}
        </div>
        <Button variant="outline" disabled={exam.isPending} onClick={() => exam.mutate({ part: IELTS_PART1, target })}>
          {exam.isPending ? <Loader2 className="animate-spin" /> : <MessagesSquare />} Bắt đầu Part 1
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Dán đề của bạn</h2>
        <Textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder={'Describe a place where you live or have lived that you really like.\nYou should say:\n- where it is\n- what the place is like\n…'}
        />
        <Button disabled={!custom} onClick={() => custom && onPick({ id: CUSTOM_TOPIC, ...custom })}>
          Luyện đề này
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={() => onPick(topics[Math.floor(Math.random() * topics.length)])}>
            <Shuffle /> Đề ngẫu nhiên
          </Button>
          {[null, ...GROUPS].map((g) => (
            <button
              key={g ?? 'all'}
              type="button"
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                group === g ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {g ?? 'Tất cả'}
            </button>
          ))}
        </div>
        <ul className="divide-y rounded-xl border bg-card">
          {topics.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onPick(t)} className="w-full px-4 py-3 text-left text-sm hover:bg-muted">
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Bài đã nói</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {history.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link to="/speaking" search={{ id: a.id }} className="min-w-0 flex-1 truncate text-foreground no-underline hover:underline">
                  {a.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.overall != null ? `band ${a.overall}` : 'chưa chấm'} (mục tiêu {a.target}) · {mmss(a.durationSec)} · {a.createdAt.toLocaleDateString('vi-VN')}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  title="Xoá bài này"
                  onClick={() => remove.mutate(a.id)}
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

function CueCard({ topic }: { topic: Topic }) {
  return (
    <div className="rounded-xl border-2 border-primary/40 bg-card p-5">
      <p className="text-lg font-semibold">{topic.title}</p>
      {topic.bullets.length > 0 && (
        <>
          <p className="mt-3 text-sm text-muted-foreground">You should say:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {topic.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Practice({ topic, onCancel, onDone }: { topic: Topic & { target: SpeakingTarget }; onCancel: () => void; onDone: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<'prep' | 'speak'>('prep')
  const [prepLeft, setPrepLeft] = useState(PREP_SECONDS)
  const [notes, setNotes] = useState('')
  const startedAt = useRef(0)

  const submit = useMutation({
    mutationFn: (input: { blob: Blob; durationSec: number }) => {
      const form = new FormData()
      form.set('audio', new File([input.blob], `rec.${input.blob.type.includes('mp4') ? 'm4a' : 'webm'}`, { type: input.blob.type }))
      form.set('topicId', topic.id)
      form.set('title', topic.title)
      form.set('bullets', JSON.stringify(topic.bullets))
      form.set('durationSec', String(input.durationSec))
      form.set('target', topic.target)
      return submitSpeaking({ data: form })
    },
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: speakingAttemptsQuery().queryKey })
      void queryClient.invalidateQueries({ queryKey: statsQuery().queryKey })
      onDone()
      void navigate({ to: '/speaking', search: { id } })
    },
  })

  const recorder = useRecorder({
    maxMs: MAX_SPEAK_SECONDS * 1000,
    onStop: (blob) => {
      const durationSec = Math.round((performance.now() - startedAt.current) / 1000)
      if (blob.size > 2_000) submit.mutate({ blob, durationSec })
    },
  })

  const startSpeaking = () => {
    setPhase('speak')
    startedAt.current = performance.now()
    void recorder.start()
  }

  // đếm ngược thời gian chuẩn bị, hết giờ thì tự bắt đầu ghi âm như phòng thi
  useEffect(() => {
    if (phase !== 'prep') return
    if (prepLeft <= 0) {
      startSpeaking()
      return
    }
    const t = setTimeout(() => setPrepLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, prepLeft])

  const spoken = recorder.elapsedMs / 1000

  return (
    <>
      <header className="flex items-center gap-3">
        <Button size="icon" variant="ghost" title="Chọn đề khác" onClick={onCancel} disabled={recorder.recording || submit.isPending}>
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-semibold">{phase === 'prep' ? 'Chuẩn bị' : 'Nói'}</h1>
      </header>

      <CueCard topic={topic} />

      {phase === 'prep' ? (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-3xl font-semibold tabular-nums">{mmss(prepLeft)}</span>
            <Button onClick={startSpeaking}>
              <Mic /> Bắt đầu nói ngay
            </Button>
          </div>
          <Progress value={((PREP_SECONDS - prepLeft) / PREP_SECONDS) * 100} />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Ghi ý chính (vài từ khoá cho mỗi gợi ý)…" />
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          {notes && <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{notes}</p>}
          <div className="flex items-center justify-between gap-3">
            <span className={cn('font-mono text-3xl font-semibold tabular-nums', recorder.recording && 'text-rec')}>
              {mmss(spoken)} <span className="text-base text-muted-foreground">/ {mmss(MAX_SPEAK_SECONDS)}</span>
            </span>
            {recorder.recording ? (
              <Button variant="destructive" onClick={recorder.stop}>
                <Square /> Nộp bài
              </Button>
            ) : submit.isPending ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Đang nghe bài nói…
              </span>
            ) : (
              <Button onClick={startSpeaking}>
                <Mic /> Nói lại
              </Button>
            )}
          </div>
          <Progress value={(spoken / MAX_SPEAK_SECONDS) * 100} />
          {recorder.recording && (
            <p className="text-xs text-muted-foreground">
              {spoken < 60 ? 'Cố nói ít nhất 1 phút, tốt nhất gần 2 phút.' : 'Tốt, tiếp tục đến khi hết ý (tự dừng ở 2:00).'}
            </p>
          )}
          {(submit.error || recorder.error) && (
            <p role="alert" className="text-sm text-destructive">
              {submit.error?.message ?? recorder.error}
            </p>
          )}
        </section>
      )}
    </>
  )
}

function Result({ id, onRetry }: { id: number; onRetry: (t: Topic & { target: SpeakingTarget }) => void }) {
  const queryClient = useQueryClient()
  const [accent] = useAccent()
  const { data, isLoading, error } = useQuery(speakingAttemptQuery(id))
  const exam = useExam()
  const assess = useMutation({
    mutationFn: () => assessSpeaking({ data: { id } }),
    onSuccess: (feedback) => {
      queryClient.setQueryData(speakingAttemptQuery(id).queryKey, (old) => (old ? { ...old, feedback } : old))
      void queryClient.invalidateQueries({ queryKey: speakingAttemptsQuery().queryKey })
    },
  })

  // bài vừa nộp chưa có nhận xét: tự chấm một lần
  const needsAssess = !!data && !data.feedback
  const { mutate, isIdle } = assess
  useEffect(() => {
    if (needsAssess && isIdle) mutate()
  }, [needsAssess, isIdle, mutate])

  if (isLoading)
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  if (!data) return <p className="text-destructive">{error?.message ?? 'Không tìm thấy bài nói'}</p>

  const fb = data.feedback
  const target = data.target as SpeakingTarget
  const words = data.transcript.split(/\s+/).filter(Boolean).length

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <Button asChild size="icon" variant="ghost" title="Chọn đề khác">
          <Link to="/speaking" search={{}}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="flex-1 text-xl font-semibold">Kết quả</h1>
        <Button variant="outline" onClick={() => onRetry({ id: data.topicId, title: data.title, bullets: data.bullets, target })}>
          <RotateCcw /> Nói lại đề này
        </Button>
        <Button disabled={exam.isPending} onClick={() => exam.mutate({ part: IELTS_PART3, target, part2Title: data.title })}>
          {exam.isPending ? <Loader2 className="animate-spin" /> : <MessagesSquare />} Tiếp Part 3
        </Button>
      </header>

      <CueCard topic={{ id: data.topicId, title: data.title, bullets: data.bullets }} />

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Bài nói của bạn</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Mục tiêu {SPEAKING_TARGET_LABEL[data.target as SpeakingTarget]} · {mmss(data.durationSec)} · {words} từ{data.durationSec ? ` · ${Math.round((words / data.durationSec) * 60)} từ/phút` : ''}
        </p>
        {data.hasAudio && <audio controls src={`/api/speaking-audio/${data.id}`} className="mt-3 w-full" />}
        <p className="mt-2 whitespace-pre-wrap">{data.transcript}</p>
        {exam.error && <p className="mt-2 text-sm text-destructive">{exam.error.message}</p>}
      </section>

      {!fb ? (
        <section className="flex flex-col items-start gap-2 rounded-xl border bg-card p-5">
          {assess.isError ? (
            <>
              <p role="alert" className="text-sm text-destructive">
                {assess.error.message}
              </p>
              <Button variant="outline" onClick={() => assess.mutate()}>
                Chấm lại
              </Button>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> AI đang chấm bài…
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <div className="flex items-center gap-4">
              <div className="grid size-20 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <span className="text-3xl font-bold">{fb.overall}</span>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Band ước lượng</p>
                <p className="mt-1 text-sm">{fb.summary}</p>
              </div>
            </div>
            <div className={cn('grid gap-2', fb.pronunciation ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
              {[...fb.criteria, ...(fb.pronunciation ? [{ name: 'Pronunciation', ...fb.pronunciation }] : [])].map((c) => (
                <div key={c.name} className="rounded-lg bg-muted/60 p-3">
                  <p className="flex items-baseline justify-between gap-2 text-sm font-medium">
                    {c.name} <span className="text-lg font-semibold">{c.band}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.comment}</p>
                </div>
              ))}
            </div>
            {!fb.pronunciation && (
              <p className="text-xs text-muted-foreground">
                Chưa chấm Pronunciation: cần chọn LLM nghe audio (Gemini / OpenAI) ở mục chấm phát âm trong Cài đặt.
              </p>
            )}
            {fb.covered.length > 0 && (
              <ul className="space-y-1 text-sm">
                {fb.covered.map((c) => (
                  <li key={c.point} className="flex items-center gap-2">
                    {c.done ? <Check className="size-4 text-ok" /> : <X className="size-4 text-destructive" />}
                    <span className={cn(!c.done && 'text-muted-foreground')}>{c.point}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {fb.corrections.length > 0 && (
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">
                Câu nên sửa <span className="text-sm font-normal text-muted-foreground">· đã lưu vào Sổ lỗi</span>
              </h2>
              {fb.corrections.map((c, i) => (
                <div key={i} className="rounded-lg bg-muted/60 p-3 text-sm">
                  <p className="text-muted-foreground line-through">{c.said}</p>
                  <p className="flex items-center gap-1 font-medium">
                    {c.better}
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => speak(c.better, { accent })} aria-label="Nghe">
                      <Volume2 />
                    </Button>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">{mistakeLabel(c.type)}</span> · {c.explanation}
                  </p>
                </div>
              ))}
            </section>
          )}

          {fb.pronunciation && fb.pronunciation.mistakes.length > 0 && (
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">
                Lỗi phát âm <span className="text-sm font-normal text-muted-foreground">· đã lưu vào Sổ lỗi</span>
              </h2>
              {fb.pronunciation.mistakes.map((m, i) => (
                <div key={i} className="rounded-lg bg-muted/60 p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-x-2 font-medium">
                    {m.word}
                    {m.ipa && <span className="font-mono text-xs text-muted-foreground">{m.ipa}</span>}
                    {m.heard && <span className="text-xs font-normal text-muted-foreground">nghe như “{m.heard}”</span>}
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => speak(m.word, { accent })} aria-label="Nghe">
                      <Volume2 />
                    </Button>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">{mistakeLabel(m.type)}</span> · {m.explanation} {m.tip}
                  </p>
                </div>
              ))}
            </section>
          )}

          {fb.vocabulary.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Từ vựng ăn điểm</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {fb.vocabulary.map((v) => (
                  <li key={v.en} className="flex items-start gap-1 rounded-lg border p-2 text-sm">
                    <span className="flex-1">
                      <span className="block font-medium">{v.en}</span>
                      <span className="text-xs text-muted-foreground">{v.vi}</span>
                    </span>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => speak(v.en, { accent })} aria-label="Nghe">
                      <Volume2 />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-2 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Bài mẫu {SPEAKING_TARGET_LABEL[data.target as SpeakingTarget]}</h2>
              <Button size="sm" variant="outline" onClick={() => speakLong(fb.sample, { accent })}>
                <Volume2 /> Nghe
              </Button>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{fb.sample}</p>
          </section>
        </>
      )}
    </>
  )
}
