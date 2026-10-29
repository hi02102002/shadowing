import { useState } from 'react'
import type { ReactNode } from 'react'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  HelpCircle,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react'
import { z } from 'zod'

import { GrammarDrillPanel } from '#/components/grammar-drill'
import { HtmlNodes } from '#/components/html-nodes'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAccent } from '#/hooks/use-app-settings'
import { expectedAnswer, groupLabel, itemKey } from '#/lib/grammar'
import type { GrammarExercise, GrammarItem, GrammarSection, HtmlElement } from '#/lib/grammar'
import { decodeChoice, decodeRightWrong, encodeChoice, encodeRightWrong } from '#/lib/grammar-check'
import { grammarUnitQuery, mistakesQueryKey } from '#/lib/queries'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import type { GrammarExplain } from '#/server/ai/prompts'
import {
  explainGrammarAnswer,
  explainGrammarSection,
  grammarExamples,
  resetGrammarAnswers,
  saveGrammarAnswers,
} from '#/server/fns/grammar'
import type { GrammarUnitPage } from '#/server/fns/grammar'

const TABS = ['theory', 'exercises', 'ai', 'videos'] as const
type Tab = (typeof TABS)[number]

export const Route = createFileRoute('/grammar/$unitId')({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  loader: async ({ context, params }) => {
    const page = await context.queryClient.ensureQueryData(grammarUnitQuery(params.unitId))
    if (!page) throw notFound()
    return { title: page.unit.title }
  },
  head: ({ loaderData, params }) => ({
    meta: [{ title: loaderData ? `${unitLabel(params.unitId)}: ${loaderData.title} · Ngữ pháp` : 'Ngữ pháp' }],
  }),
  component: UnitPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Không có bài này</h1>
      <Link to="/grammar" className="mt-4 inline-block">
        ← Về danh sách bài
      </Link>
    </div>
  ),
})

const unitLabel = (id: string) => (id.startsWith('appendix-') ? `Phụ lục ${id.slice(9)}` : `Unit ${id}`)

function UnitPage() {
  const { unitId } = Route.useParams()
  const { tab = 'theory' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: page } = useQuery(grammarUnitQuery(unitId))
  if (!page) return null
  const { unit } = page

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
      <nav className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link to="/grammar" className="flex items-center gap-1 text-muted-foreground no-underline hover:text-foreground">
          <ArrowLeft className="size-4" /> Danh sách bài
        </Link>
        <div className="flex items-center gap-2">
          <UnitNav unit={page.prev} dir="prev" />
          <UnitNav unit={page.next} dir="next" />
        </div>
      </nav>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{unitLabel(unit.id)}</Badge>
          {groupLabel(unit.group)}
        </div>
        <h1 className="text-2xl font-semibold">{unit.title}</h1>
      </header>

      <Tabs value={tab} onValueChange={(v) => void navigate({ search: { tab: v as Tab }, replace: true })}>
        <TabsList>
          <TabsTrigger value="theory">Lý thuyết</TabsTrigger>
          <TabsTrigger value="exercises" disabled={!unit.exercises.length}>
            Bài tập
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="size-3.5" /> Luyện thêm (AI)
          </TabsTrigger>
          <TabsTrigger value="videos">Trong video của bạn</TabsTrigger>
        </TabsList>
        <TabsContent value="theory" className="mt-3 flex flex-col gap-4">
          {unit.sections.map((s, i) => (
            <SectionCard key={`${unit.id}-${i}`} unitId={unit.id} index={i} section={s} />
          ))}
        </TabsContent>
        <TabsContent value="exercises" className="mt-3 flex flex-col gap-4">
          {unit.exercises.map((ex) => (
            <ExerciseCard key={`${unit.id}-${ex.key}`} page={page} exercise={ex} />
          ))}
        </TabsContent>
        <TabsContent value="ai" className="mt-3">
          <GrammarDrillPanel unitId={unit.id} />
        </TabsContent>
        <TabsContent value="videos" className="mt-3">
          <VideoExamples unitId={unit.id} hasPattern={page.hasPattern} />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Nội dung: English Grammar in Use (Raymond Murphy, Cambridge University Press), qua essentialenglish.review.
      </p>
    </div>
  )
}

function UnitNav({ unit, dir }: { unit: { id: string; title: string } | null; dir: 'prev' | 'next' }) {
  if (!unit) return null
  return (
    <Link
      to="/grammar/$unitId"
      params={{ unitId: unit.id }}
      search={(s) => s}
      title={unit.title}
      className="flex items-center gap-1 rounded-md border px-2 py-1 text-foreground no-underline hover:bg-muted"
    >
      {dir === 'prev' && <ChevronLeft className="size-4" />}
      {unitLabel(unit.id)}
      {dir === 'next' && <ChevronRight className="size-4" />}
    </Link>
  )
}

function AiError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <span className="flex items-center gap-2 font-medium text-destructive">
        <AlertCircle className="size-4" /> Không hỏi được AI
      </span>
      <span className="text-muted-foreground">{msg}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
        {/API key|Cài đặt|Base URL|401|403/i.test(msg) && (
          <Button size="sm" variant="outline" asChild>
            <Link to="/settings">Mở Cài đặt</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

// ───────── Lý thuyết ─────────

function SectionCard({ unitId, index, section }: { unitId: string; index: number; section: GrammarSection }) {
  const explain = useMutation({ mutationFn: () => explainGrammarSection({ data: { unitId, section: index } }) })
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        {section.label ? (
          <span className="grid size-8 place-items-center rounded-md bg-primary font-semibold text-primary-foreground">
            {section.label}
          </span>
        ) : (
          <span />
        )}
        {explain.isIdle && (
          <Button size="sm" variant="outline" onClick={() => explain.mutate()}>
            <Sparkles /> Giải thích tiếng Việt
          </Button>
        )}
      </div>
      <div className="grammar-content">
        <HtmlNodes nodes={section.body} />
      </div>
      {explain.isPending && (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> AI đang giảng lại mục này…
        </p>
      )}
      {explain.isError && <AiError error={explain.error} onRetry={() => explain.mutate()} />}
      {explain.data && <ExplainPanel data={explain.data} />}
    </section>
  )
}

function ExplainPanel({ data }: { data: GrammarExplain }) {
  const [accent] = useAccent()
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-4 text-sm">
      <p className="flex items-start gap-2 font-medium">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        {data.summary}
      </p>
      <ol className="flex list-decimal flex-col gap-3 pl-5">
        {data.points.map((p, i) => (
          <li key={i}>
            <p>{p.rule}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {p.examples.map((e, j) => (
                <li key={j} className="flex items-start gap-1.5">
                  <button
                    type="button"
                    className="mt-0.5 text-muted-foreground hover:text-primary"
                    onClick={() => speak(e.en, { accent })}
                    aria-label="Nghe câu ví dụ"
                  >
                    <Volume2 className="size-3.5" />
                  </button>
                  <span>
                    <span className="font-medium">{e.en}</span>{' '}
                    <span className="text-muted-foreground">({e.vi})</span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {!!data.pitfalls.length && (
        <div className="flex flex-col gap-1 border-t pt-3">
          <span className="flex items-center gap-1.5 font-medium">
            <Lightbulb className="size-4 text-miss" /> Người Việt hay sai
          </span>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {data.pitfalls.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ───────── Bài tập ─────────

const isExample = (item: GrammarItem) => item.kind === 'text' && item.example

function ExerciseCard({ page, exercise }: { page: GrammarUnitPage; exercise: GrammarExercise }) {
  const unitId = page.unit.id
  const queryClient = useQueryClient()
  const saved = (idx: number) => page.answers[itemKey(exercise.key, idx)] as GrammarUnitPage['answers'][string] | undefined
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries(exercise.items.map((_, i) => [i, saved(i)?.answer ?? '']).filter(([, a]) => a)),
  )
  const [results, setResults] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(exercise.items.flatMap((_, i) => (saved(i) ? [[i, saved(i)!.correct]] : []))),
  )

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['grammar-units'] })
    void queryClient.invalidateQueries({ queryKey: ['grammar-unit', unitId] })
    void queryClient.invalidateQueries({ queryKey: mistakesQueryKey })
  }

  const check = useMutation({
    mutationFn: () =>
      saveGrammarAnswers({
        data: {
          unitId,
          exerciseKey: exercise.key,
          answers: Object.entries(answers).map(([idx, answer]) => ({ idx: Number(idx), answer })),
        },
      }),
    onSuccess: (res) => {
      setResults(res)
      refresh()
    },
  })
  const reset = useMutation({
    mutationFn: () => resetGrammarAnswers({ data: { unitId, exerciseKey: exercise.key } }),
    onSuccess: () => {
      setAnswers({})
      setResults({})
      why.reset()
      refresh()
    },
  })
  const why = useMutation({
    mutationFn: (idx: number) =>
      explainGrammarAnswer({ data: { unitId, exerciseKey: exercise.key, idx, answer: answers[idx] ?? '' } }),
  })

  const setAnswer = (idx: number, value: string) => {
    setAnswers((a) => ({ ...a, [idx]: value }))
    setResults(({ [idx]: _, ...rest }) => rest)
  }

  const questions = exercise.items.filter((i) => !isExample(i)).length
  const graded = Object.values(results)
  const right = graded.filter(Boolean).length

  const renderBlank = (idx: number): ReactNode => {
    const item = exercise.items[idx]
    if (item.kind === 'text') {
      return (
        <TextBlank
          item={item}
          value={item.example ? item.answers[0] : (answers[idx] ?? '')}
          result={results[idx]}
          onChange={(v) => setAnswer(idx, v)}
        />
      )
    }
    if (item.kind === 'match') {
      return (
        <select
          className={cn('mx-1 h-8 max-w-full rounded-md border bg-background px-2 text-sm', resultBorder(results[idx]))}
          value={answers[idx] ?? ''}
          onChange={(e) => setAnswer(idx, e.target.value)}
        >
          <option value="">Chọn…</option>
          {item.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    }
    if (item.kind === 'rightWrong') {
      const rw = decodeRightWrong(answers[idx] ?? '')
      if (rw.right !== false) return null
      return (
        <input
          className={cn('mt-1 h-8 w-full max-w-md rounded-md border bg-background px-2 text-sm', resultBorder(results[idx]))}
          placeholder="Sửa phần gạch chân thành…"
          value={rw.fix}
          onChange={(e) => setAnswer(idx, encodeRightWrong(false, e.target.value))}
        />
      )
    }
    return null
  }

  const renderItem = (idx: number, el: HtmlElement, children: ReactNode): ReactNode => {
    const item = exercise.items[idx]
    const inline = el.tag === 'span'
    const result = results[idx] as boolean | undefined
    const feedback = result != null && !isExample(item) && (
      <Feedback
        inline={inline}
        correct={result}
        expected={expectedAnswer(item)}
        onWhy={() => why.mutate(idx)}
        loading={why.isPending && why.variables === idx}
      />
    )
    if (inline) {
      return (
        <>
          {children}
          {feedback}
        </>
      )
    }
    return (
      <div className="flex flex-col gap-1.5">
        {item.kind === 'rightWrong' && (
          <RightWrongToggle value={answers[idx] ?? ''} onChange={(v) => setAnswer(idx, v)} />
        )}
        <div>{children}</div>
        {item.kind === 'choice' && (
          <ChoiceOptions
            item={item}
            picked={decodeChoice(answers[idx] ?? '')}
            onChange={(p) => setAnswer(idx, p.length ? encodeChoice(p) : '')}
          />
        )}
        {feedback}
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold">
          <span className="mr-2 font-mono text-primary">{exercise.key}</span>
          {exercise.title}
        </h2>
        {!!graded.length && (
          <span className="text-sm text-muted-foreground">
            Đúng{' '}
            <span className={cn('font-semibold', right === questions ? 'text-ok' : 'text-foreground')}>
              {right}/{questions}
            </span>
          </span>
        )}
      </header>
      <form
        className="grammar-content"
        onSubmit={(e) => {
          e.preventDefault()
          check.mutate()
        }}
      >
        <HtmlNodes nodes={exercise.body} renderBlank={renderBlank} renderItem={renderItem} />
        {/* Enter trong ô nhập → Kiểm tra */}
        <button type="submit" hidden />
      </form>
      {why.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> AI đang giải thích…
        </p>
      )}
      {why.isError && <AiError error={why.error} onRetry={() => why.mutate(why.variables)} />}
      {why.data && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
          <span className="text-xs text-muted-foreground">
            Câu sai: <span className="text-bad line-through">{answers[why.variables] || '(bỏ trống)'}</span> → đáp án{' '}
            <span className="font-medium text-ok">{expectedAnswer(exercise.items[why.variables])}</span>
          </span>
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            {why.data.explanation}
          </p>
          {why.data.tip && <p className="text-muted-foreground">💡 {why.data.tip}</p>}
        </div>
      )}
      {check.isError && <p className="text-sm text-destructive">{check.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => check.mutate()} disabled={check.isPending || !Object.keys(answers).length}>
          {check.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Kiểm tra
        </Button>
        {(!!graded.length || !!Object.keys(answers).length) && (
          <Button variant="ghost" onClick={() => reset.mutate()} disabled={reset.isPending}>
            <RotateCcw /> Làm lại
          </Button>
        )}
      </div>
    </section>
  )
}

const resultBorder = (result: boolean | undefined) =>
  result === true ? 'border-ok bg-ok-soft/50' : result === false ? 'border-bad bg-bad-soft/50' : ''

function TextBlank({
  item,
  value,
  result,
  onChange,
}: {
  item: Extract<GrammarItem, { kind: 'text' }>
  value: string
  result: boolean | undefined
  onChange: (v: string) => void
}) {
  const longest = Math.max(...item.answers.map((a) => a.length), 6)
  return (
    <input
      className={cn(
        'mx-1 inline-block h-8 rounded-md border bg-background px-2 align-baseline text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        item.example && 'border-dashed bg-muted text-muted-foreground',
        item.long && 'my-1 w-full max-w-xl',
        resultBorder(result),
      )}
      style={item.long ? undefined : { width: `${Math.min(longest + 4, 40)}ch` }}
      value={value}
      disabled={item.example}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  )
}

function RightWrongToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { right, fix } = decodeRightWrong(value)
  return (
    <div className="flex gap-1">
      {([true, false] as const).map((r) => (
        <Button
          key={String(r)}
          type="button"
          size="sm"
          variant={right === r ? 'default' : 'outline'}
          className="h-7"
          onClick={() => onChange(encodeRightWrong(r, fix))}
        >
          {r ? 'Đúng' : 'Sai'}
        </Button>
      ))}
    </div>
  )
}

function ChoiceOptions({
  item,
  picked,
  onChange,
}: {
  item: Extract<GrammarItem, { kind: 'choice' }>
  picked: number[]
  onChange: (p: number[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.options.map((o, i) => {
        const on = picked.includes(i)
        return (
          <Button
            key={i}
            type="button"
            size="sm"
            variant={on ? 'default' : 'outline'}
            className="h-auto min-h-7 py-1 whitespace-normal"
            onClick={() => onChange(item.multi ? (on ? picked.filter((p) => p !== i) : [...picked, i]) : on ? [] : [i])}
          >
            {o}
          </Button>
        )
      })}
      {item.multi && <span className="self-center text-xs text-muted-foreground">(có thể chọn nhiều)</span>}
    </div>
  )
}

function Feedback({
  inline,
  correct,
  expected,
  onWhy,
  loading,
}: {
  inline: boolean
  correct: boolean
  expected: string
  onWhy: () => void
  loading: boolean
}) {
  if (correct) return <CheckCircle2 className={cn('inline size-4 text-ok', inline ? 'mx-0.5 align-[-3px]' : '')} />
  const why = (
    <button
      type="button"
      onClick={onWhy}
      className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
      disabled={loading}
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <HelpCircle className="size-3" />}
      Vì sao sai?
    </button>
  )
  if (inline) {
    return (
      <span className="mx-0.5 inline-flex items-baseline gap-1 text-sm">
        <span className="font-medium text-ok">{expected}</span>
        {why}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <XCircle className="size-4 text-bad" />
      <span>
        Đáp án: <span className="font-medium text-ok">{expected}</span>
      </span>
      {why}
    </div>
  )
}

// ───────── Câu trong video ─────────

function VideoExamples({ unitId, hasPattern }: { unitId: string; hasPattern: boolean }) {
  const { data, isPending } = useQuery({
    queryKey: ['grammar-examples', unitId],
    queryFn: () => grammarExamples({ data: { unitId } }),
    enabled: hasPattern,
  })
  if (!hasPattern) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Chủ điểm này khó nhận ra tự động trong transcript nên chưa có ví dụ từ video.
      </p>
    )
  }
  if (isPending) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tìm trong các video của bạn…
      </p>
    )
  }
  if (!data?.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Chưa thấy câu nào dùng cấu trúc này trong các video đã thêm.
        <Button size="sm" variant="outline" asChild>
          <Link to="/explore" search={{ level: 'A1', source: 'elllo' }}>
            <Clapperboard /> Tìm thêm video
          </Link>
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Câu thật trong video bạn đã thêm (tìm tự động nên đôi khi nhầm). Bấm để mở chế độ shadowing đúng câu đó.
      </p>
      <ul className="flex flex-col gap-2">
        {data.map((ex) => (
          <li key={`${ex.youtubeId}-${ex.idx}`}>
            <Link
              to="/videos/$videoId/shadow"
              params={{ videoId: ex.youtubeId }}
              search={{ seg: ex.idx }}
              className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-foreground no-underline transition-colors hover:border-primary/60 hover:bg-muted"
            >
              <span>
                {ex.text.slice(0, ex.match[0])}
                <mark className="rounded bg-primary/15 px-0.5 text-foreground">{ex.text.slice(ex.match[0], ex.match[1])}</mark>
                {ex.text.slice(ex.match[1])}
              </span>
              <span className="truncate text-xs text-muted-foreground">{ex.videoTitle}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
