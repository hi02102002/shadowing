import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Lightbulb, Loader2, MessagesSquare, Send, Trash2, Volume2 } from 'lucide-react'
import { z } from 'zod'

import { RecordButton } from '#/components/record-button'
import { SpeakTabs } from '#/components/speak-tabs'
import { Button } from '#/components/ui/button'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import { useAccent } from '#/hooks/use-app-settings'
import { useRecorder } from '#/hooks/use-recorder'
import { useStoredToggle } from '#/hooks/use-stored-toggle'
import { CUSTOM_SCENARIO, MAX_USER_TURNS, SCENARIOS, TALK_LEVELS, TALK_LEVEL_LABEL, scenarioLabel } from '#/lib/conversation'
import type { TalkLevel } from '#/lib/conversation'
import { conversationQuery, conversationsQuery, statsQuery } from '#/lib/queries'
import { speak, speakLong } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { mistakeLabel } from '#/server/ai/prompts'
import { deleteConversation, finishConversation, sendTurn, startConversation } from '#/server/fns/conversation'
import type { ConversationFeedback } from '#/db/schema'
import type { ConversationDetail } from '#/server/fns/conversation'

const searchSchema = z.object({
  id: z.number().int().optional().catch(undefined),
})

export const Route = createFileRoute('/talk')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Hội thoại · Shadowing' }] }),
  component: TalkPage,
})

function TalkPage() {
  const { id } = Route.useSearch()
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      {id ? <ConversationView key={id} id={id} /> : <Setup />}
    </div>
  )
}

function Setup() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [scenario, setScenario] = useState(SCENARIOS[0].id)
  const [custom, setCustom] = useState('')
  const [level, setLevel] = useState<TalkLevel>('B1')
  const { data: history = [] } = useQuery(conversationsQuery())

  const start = useMutation({
    mutationFn: () => startConversation({ data: { scenario, level, custom: scenario === CUSTOM_SCENARIO ? custom : undefined } }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: conversationsQuery().queryKey })
      void navigate({ to: '/talk', search: { id } })
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteConversation({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsQuery().queryKey }),
  })

  return (
    <>
      <header className="flex flex-col gap-3">
        <SpeakTabs />
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <MessagesSquare className="size-6 text-primary" /> Hội thoại với AI
        </h1>
        <p className="text-sm text-muted-foreground">
          Nhập vai một tình huống thật, nói (hoặc gõ) câu của bạn. Kết thúc buổi để AI chỉ ra câu chưa đúng và cách nói tự nhiên hơn.
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
          {[...SCENARIOS, { id: CUSTOM_SCENARIO, label: 'Chủ đề của bạn', detail: 'Tự mô tả tình huống muốn luyện' }].map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={scenario === s.id}
              onClick={() => setScenario(s.id)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                scenario === s.id ? 'border-primary bg-primary/5' : 'hover:bg-muted',
              )}
            >
              <span className="block font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.detail}</span>
            </button>
          ))}
        </div>
        {scenario === CUSTOM_SCENARIO && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tình huống
            <Textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={300}
              placeholder="Vd. Thuyết phục sếp cho làm việc từ xa hai ngày mỗi tuần"
            />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Trình độ</span>
          {TALK_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={cn(
                'rounded-full border px-3 py-1 transition-colors',
                level === l ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {TALK_LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
        {start.error && (
          <p role="alert" className="text-sm text-destructive">
            {start.error.message}
          </p>
        )}
        <Button type="submit" disabled={start.isPending || (scenario === CUSTOM_SCENARIO && !custom.trim())}>
          {start.isPending ? <Loader2 className="animate-spin" /> : <MessagesSquare />} Bắt đầu nói
        </Button>
      </form>

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Các buổi trước</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {history.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link to="/talk" search={{ id: c.id }} className="min-w-0 flex-1 truncate text-foreground no-underline hover:underline">
                  {scenarioLabel(c.scenario, c.topic)}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.level} · {c.turns} lượt · {c.endedAt ? 'đã nhận xét' : 'đang dở'} · {c.createdAt.toLocaleDateString('vi-VN')}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  title="Xoá buổi này"
                  onClick={() => remove.mutate(c.id)}
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

type Turn = ConversationDetail['turns'][number]

function ConversationView({ id }: { id: number }) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery(conversationQuery(id))
  const [accent] = useAccent()
  // mặc định tự đọc: công tắc lưu trạng thái "tắt"
  const [speakOff, setSpeakOff] = useStoredToggle('talk-auto-speak-off')
  const speakOn = !speakOff
  const [text, setText] = useState('')
  const [showHints, setShowHints] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const spokenRef = useRef<number | null>(null)

  const turns = data?.turns ?? []
  const lastAi = [...turns].reverse().find((t) => t.role === 'ai')
  const userTurns = turns.filter((t) => t.role === 'user').length
  const ended = !!data?.endedAt

  // đọc to lượt AI mới nhất (một lần), kể cả câu mở đầu
  useEffect(() => {
    if (!lastAi || ended || spokenRef.current === lastAi.id) return
    const first = spokenRef.current === null
    spokenRef.current = lastAi.id
    // mở lại buổi cũ thì không tự đọc câu cuối, chỉ đọc khi buổi vừa bắt đầu
    if (speakOn && (!first || turns.length === 1)) speakLong(lastAi.text, { accent })
  }, [lastAi, ended, speakOn, accent, turns.length])

  const send = useMutation({
    mutationFn: (input: { audio?: Blob; text?: string }) => {
      const form = new FormData()
      form.set('id', String(id))
      if (input.audio)
        form.set('audio', new File([input.audio], `rec.${input.audio.type.includes('mp4') ? 'm4a' : 'webm'}`, { type: input.audio.type }))
      if (input.text) form.set('text', input.text)
      return sendTurn({ data: form })
    },
    onSuccess: ({ user, ai }) => {
      setText('')
      setShowHints(false)
      queryClient.setQueryData(conversationQuery(id).queryKey, (old) => (old ? { ...old, turns: [...old.turns, user, ai] } : old))
      void queryClient.invalidateQueries({ queryKey: statsQuery().queryKey })
    },
  })

  const finish = useMutation({
    mutationFn: () => finishConversation({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationQuery(id).queryKey })
      void queryClient.invalidateQueries({ queryKey: conversationsQuery().queryKey })
    },
  })

  const recorder = useRecorder({
    maxMs: 45_000,
    onStop: (blob) => {
      // bản ghi quá ngắn thường là bấm nhầm
      if (blob.size > 2_000) send.mutate({ audio: blob })
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns.length, send.isPending, data?.feedback])

  if (isLoading)
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  if (!data) return <p className="text-destructive">{error?.message ?? 'Không tìm thấy buổi hội thoại'}</p>

  const busy = send.isPending || finish.isPending
  const limitReached = userTurns >= MAX_USER_TURNS

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <Button asChild size="icon" variant="ghost" title="Chọn tình huống khác">
          <Link to="/talk" search={{}}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{scenarioLabel(data.scenario, data.topic)}</h1>
          <p className="text-xs text-muted-foreground">
            {data.level} · {userTurns} lượt nói
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={speakOn} onCheckedChange={(on) => setSpeakOff(!on)} /> Tự đọc
        </label>
      </header>

      <div className="flex flex-col gap-3">
        {turns.map((t) => (
          <Bubble key={t.id} turn={t} onSpeak={() => speakLong(t.text, { accent })} />
        ))}
        {send.isPending && (
          <div className="flex items-center gap-2 self-end rounded-2xl bg-primary/10 px-4 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {send.variables.audio ? 'Đang nghe…' : 'Đang trả lời…'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {data.feedback ? (
        <Feedback feedback={data.feedback} onSpeak={(s) => speak(s, { accent })} />
      ) : (
        <section className="sticky bottom-0 flex flex-col gap-3 rounded-xl border bg-card/95 p-4 backdrop-blur">
          {lastAi?.hints?.length ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowHints((v) => !v)}
              >
                <Lightbulb className="size-3.5" /> {showHints ? 'Ẩn gợi ý' : 'Gợi ý câu trả lời'}
              </button>
              {showHints && (
                <div className="flex flex-wrap gap-1.5">
                  {lastAi.hints.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setText(h)
                        speak(h, { accent })
                      }}
                      className="rounded-full border px-3 py-1 text-left text-sm hover:bg-muted"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-end gap-3">
            <RecordButton
              recording={recorder.recording}
              busy={send.isPending && !!send.variables.audio}
              level={recorder.level}
              elapsedMs={recorder.elapsedMs}
              onStart={recorder.start}
              onStop={recorder.stop}
              disabled={busy || limitReached}
              label="Bấm để nói"
            />
            <form
              className="flex flex-1 items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (text.trim()) send.mutate({ text: text.trim() })
              }}
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (text.trim() && !busy) send.mutate({ text: text.trim() })
                  }
                }}
                placeholder="Hoặc gõ câu trả lời (Enter để gửi)"
                className="min-h-10"
                disabled={busy || limitReached}
              />
              <Button type="submit" size="icon" disabled={busy || limitReached || !text.trim()} aria-label="Gửi">
                <Send />
              </Button>
            </form>
          </div>

          {(send.error || finish.error || recorder.error) && (
            <p role="alert" className="text-sm text-destructive">
              {send.error?.message ?? finish.error?.message ?? recorder.error}
            </p>
          )}
          {limitReached && <p className="text-sm text-muted-foreground">Đã đủ {MAX_USER_TURNS} lượt cho buổi này.</p>}

          <Button variant="outline" disabled={busy || userTurns === 0} onClick={() => finish.mutate()}>
            {finish.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Kết thúc & nhận xét
          </Button>
        </section>
      )}
    </>
  )
}

function Bubble({ turn, onSpeak }: { turn: Turn; onSpeak: () => void }) {
  const ai = turn.role === 'ai'
  return (
    <div className={cn('flex max-w-[85%] items-start gap-1', ai ? 'self-start' : 'flex-row-reverse self-end')}>
      <p className={cn('rounded-2xl px-4 py-2', ai ? 'bg-muted' : 'bg-primary text-primary-foreground')}>{turn.text}</p>
      {ai && (
        <Button size="icon" variant="ghost" className="size-8 shrink-0 text-muted-foreground" onClick={onSpeak} aria-label="Nghe lại">
          <Volume2 />
        </Button>
      )}
    </div>
  )
}

function Feedback({ feedback, onSpeak }: { feedback: ConversationFeedback; onSpeak: (text: string) => void }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Nhận xét</h2>
        <p className="mt-1 text-sm">{feedback.summary}</p>
      </div>

      {feedback.corrections.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">
            Câu nên sửa <span className="font-normal text-muted-foreground">· đã lưu vào Sổ lỗi</span>
          </h3>
          {feedback.corrections.map((c, i) => (
            <div key={i} className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="text-muted-foreground line-through">{c.said}</p>
              <p className="flex items-center gap-1 font-medium">
                {c.better}
                <Button size="icon" variant="ghost" className="size-7" onClick={() => onSpeak(c.better)} aria-label="Nghe">
                  <Volume2 />
                </Button>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium">{mistakeLabel(c.type)}</span> · {c.explanation}
              </p>
            </div>
          ))}
        </div>
      )}

      {feedback.phrases.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Cụm từ nên dùng</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {feedback.phrases.map((p) => (
              <li key={p.en} className="flex items-start gap-1 rounded-lg border p-2 text-sm">
                <span className="flex-1">
                  <span className="block font-medium">{p.en}</span>
                  <span className="text-xs text-muted-foreground">{p.vi}</span>
                </span>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => onSpeak(p.en)} aria-label="Nghe">
                  <Volume2 />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button asChild variant="outline">
        <Link to="/talk" search={{}}>
          Luyện tình huống khác
        </Link>
      </Button>
    </section>
  )
}
