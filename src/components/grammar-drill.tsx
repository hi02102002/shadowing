import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, RotateCcw, Sparkles, Undo2, Volume2, XCircle } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { useAccent } from '#/hooks/use-app-settings'
import { matchesAnswer } from '#/lib/grammar-check'
import { mistakesQueryKey } from '#/lib/queries'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import type { DrillLevel, DrillType } from '#/server/ai/prompts'
import { grammarDrill, recordDrillMistakes } from '#/server/fns/grammar'
import type { GrammarDrillSet } from '#/server/fns/grammar'

const LEVELS: Array<{ value: DrillLevel; label: string; desc: string }> = [
  { value: 'easy', label: 'Dễ', desc: 'A2 · câu ngắn, dạng cơ bản' },
  { value: 'medium', label: 'Vừa', desc: 'B1 · trộn phủ định, nghi vấn, cấu trúc dễ nhầm' },
  { value: 'hard', label: 'Khó', desc: 'B2–C1 · câu phức, ngoại lệ, bẫy hay sai' },
]

const TYPES: Array<{ value: DrillType; label: string }> = [
  { value: 'fill', label: 'Điền từ' },
  { value: 'choice', label: 'Trắc nghiệm' },
  { value: 'fix', label: 'Tìm & sửa lỗi' },
  { value: 'order', label: 'Sắp xếp câu' },
  { value: 'rewrite', label: 'Viết lại câu' },
]
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label])) as Record<DrillType, string>

const LEVEL_KEY = 'grammar-drill.level'
const COUNT_KEY = 'grammar-drill.count'
const MAX_COUNT = 50
const TYPES_KEY = 'grammar-drill.types'

type Question = GrammarDrillSet['questions'][number]

/** lựa chọn nhớ trong trình duyệt, đọc sau khi mount để khớp HTML render ở server */
function useStored<T>(key: string, initial: T, valid: (v: unknown) => v is T) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown
      if (valid(saved)) setValue(saved)
    } catch {
      /* private mode */
    }
  }, [key])
  const change = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* private mode */
    }
  }
  return [value, change] as const
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_COUNT
const isLevel = (v: unknown): v is DrillLevel => LEVELS.some((l) => l.value === v)
const isTypes = (v: unknown): v is DrillType[] =>
  Array.isArray(v) && v.length > 0 && v.every((t) => TYPES.some((x) => x.value === t))

/**
 * Luyện thêm bằng bài tập AI tạo theo độ khó và dạng bài. Chỉ gọi AI khi bấm "Tạo"; bộ gần nhất của mỗi độ khó
 * được lưu lại. Câu sai ghi vào Sổ lỗi như bài tập trong sách.
 */
export function GrammarDrillPanel({ unitId }: { unitId: string }) {
  const queryClient = useQueryClient()
  const [level, setLevel] = useStored<DrillLevel>(LEVEL_KEY, 'medium', isLevel)
  const [types, setTypes] = useStored<DrillType[]>(TYPES_KEY, TYPES.map((t) => t.value), isTypes)
  const [count, setCount] = useStored<number>(COUNT_KEY, 10, isCount)
  const toggleType = (t: DrillType) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t]
    if (next.length) setTypes(next)
  }

  const queryKey = ['grammar-drill', unitId, level]
  const drill = useQuery({
    queryKey,
    queryFn: () => grammarDrill({ data: { unitId, level, generate: false } }),
    staleTime: Infinity,
  })
  const generate = useMutation({
    mutationFn: (l: DrillLevel) => grammarDrill({ data: { unitId, level: l, types, count, generate: true } }),
    onSuccess: (set, l) => queryClient.setQueryData(['grammar-drill', unitId, l], set),
  })
  const busy = generate.isPending && generate.variables === level

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Độ khó">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={level === l.value}
                title={l.desc}
                onClick={() => setLevel(l.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium',
                  level === l.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">{LEVELS.find((l) => l.value === level)?.desc}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-muted-foreground">Dạng bài:</span>
          {TYPES.map((t) => {
            const on = types.includes(t.value)
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleType(t.value)}
                className={cn(
                  'rounded-full border px-3 py-0.5 text-sm transition-colors',
                  on ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            )
          })}
          <label className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            Số câu
            <input
              type="number"
              min={1}
              max={MAX_COUNT}
              value={count}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value))
                if (n >= 1) setCount(Math.min(n, MAX_COUNT))
              }}
              className="h-8 w-16 rounded-md border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <Button size="sm" onClick={() => generate.mutate(level)} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? `AI đang tạo ${count} câu…` : drill.data ? `Tạo bộ mới (${count} câu)` : `Tạo ${count} câu bằng AI`}
          </Button>
        </div>
      </div>

      {generate.isError && <p className="text-sm text-destructive">{generate.error.message}</p>}

      {drill.isPending ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : drill.data ? (
        <DrillQuestions key={drill.data.createdAt} unitId={unitId} set={drill.data} />
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Chọn độ khó, dạng bài và số câu (tối đa {MAX_COUNT}) rồi bấm tạo: AI tự đặt câu mới luyện đúng chủ điểm của bài
          này.
        </p>
      )}
    </div>
  )
}

/** từ của câu sắp xếp, xáo trộn cố định theo số thứ tự câu (render lại không đổi chỗ); bỏ dấu câu cuối, viết thường chữ đầu */
function orderTokens(q: Question, seed: number) {
  const tokens = q.answers[0]
    .replace(/[.?!]+$/, '')
    .split(/\s+/)
    .filter(Boolean)
  if (tokens[0] && tokens[0] !== 'I' && !tokens[0].startsWith("I'")) tokens[0] = tokens[0].charAt(0).toLowerCase() + tokens[0].slice(1)
  let s = seed + 7
  const out = tokens.map((t, i) => ({ t, i }))
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  // xáo xong vẫn trùng thứ tự gốc → đảo hai từ đầu
  if (out.length > 1 && out.every((x, i) => x.i === i)) [out[0], out[1]] = [out[1], out[0]]
  return out.map((x) => x.t)
}

/** câu đầy đủ để nghe sau khi chấm */
const fullSentence = (q: Question) =>
  q.type === 'fill' || q.type === 'choice'
    ? q.prompt.replace('___', q.answers[0])
    : q.type === 'fix'
      ? q.prompt.replace(q.wrong, q.answers[0])
      : q.answers[0]

function DrillQuestions({ unitId, set }: { unitId: string; set: GrammarDrillSet }) {
  const queryClient = useQueryClient()
  const [accent] = useAccent()
  const [answers, setAnswers] = useState<Record<number, string>>({})
  // câu sắp xếp: vị trí các từ đã chọn theo thứ tự
  const [orders, setOrders] = useState<Record<number, number[]>>({})
  const [checked, setChecked] = useState(false)
  const record = useMutation({
    mutationFn: (wrong: Array<{ prompt: string; expected: string; answer: string }>) =>
      recordDrillMistakes({ data: { unitId, wrong } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: mistakesQueryKey }),
  })

  const tokens = (q: Question, i: number) => (q.type === 'order' ? orderTokens(q, i) : [])
  const answerOf = (q: Question, i: number) =>
    q.type === 'order' ? (orders[i] ?? []).map((t) => tokens(q, i)[t]).join(' ') : (answers[i] ?? '')
  const correct = (q: Question, i: number) => matchesAnswer(answerOf(q, i), q.answers)
  const score = set.questions.filter(correct).length
  const started = Object.values(answers).some(Boolean) || Object.values(orders).some((o) => o.length)

  const check = () => {
    setChecked(true)
    const wrong = set.questions.flatMap((q, i) =>
      correct(q, i) ? [] : [{ prompt: q.prompt, expected: q.answers[0], answer: answerOf(q, i) }],
    )
    if (wrong.length) record.mutate(wrong)
  }

  const setText = (i: number, v: string) => !checked && setAnswers((a) => ({ ...a, [i]: v }))
  const setOrder = (i: number, picked: number[]) => !checked && setOrders((o) => ({ ...o, [i]: picked }))

  const resultBorder = (ok: boolean) => (ok ? 'border-ok bg-ok-soft/50' : 'border-bad bg-bad-soft/50')

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!checked) check()
      }}
    >
      <ol className="flex flex-col gap-3">
        {set.questions.map((q, i) => {
          const ok = checked && correct(q, i)
          const textInput = (placeholder: string) => (
            <input
              className={cn(
                'h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                checked && resultBorder(ok),
              )}
              placeholder={placeholder}
              value={answers[i] ?? ''}
              readOnly={checked}
              onChange={(e) => setText(i, e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          )
          return (
            <li
              key={i}
              className={cn(
                'flex flex-col gap-2 rounded-xl border bg-card p-4',
                checked && (ok ? 'border-ok/50' : 'border-bad/50'),
              )}
            >
              <span className="text-xs font-medium text-muted-foreground">
                {i + 1}. {TYPE_LABEL[q.type]}
                {q.type === 'fix' && ' — câu có một lỗi sai, gõ phần đã sửa (hoặc cả câu)'}
                {q.type === 'order' && ' — bấm các từ theo đúng thứ tự'}
              </span>
              {q.type === 'fill' || q.type === 'choice' ? (
                <FillPrompt
                  q={q}
                  value={answers[i] ?? ''}
                  checked={checked}
                  ok={ok}
                  onChange={(v) => setText(i, v)}
                />
              ) : q.type === 'fix' ? (
                <>
                  <p className="leading-relaxed">
                    {checked ? (
                      <>
                        {q.prompt.slice(0, q.prompt.indexOf(q.wrong))}
                        <span className="rounded bg-bad-soft px-0.5 text-bad line-through">{q.wrong}</span>
                        {q.prompt.slice(q.prompt.indexOf(q.wrong) + q.wrong.length)}
                      </>
                    ) : (
                      q.prompt
                    )}
                  </p>
                  {textInput('Phần đã sửa, vd. "goes" — hoặc gõ lại cả câu')}
                </>
              ) : q.type === 'order' ? (
                <OrderPrompt
                  q={q}
                  tokens={tokens(q, i)}
                  picked={orders[i] ?? []}
                  checked={checked}
                  ok={ok}
                  onChange={(p) => setOrder(i, p)}
                />
              ) : (
                <>
                  <p className="leading-relaxed">{q.prompt}</p>
                  {q.hint && <p className="text-sm text-primary">{q.hint}</p>}
                  {textInput('Viết lại cả câu')}
                </>
              )}
              {q.type === 'choice' && (
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map((o) => (
                    <Button
                      key={o}
                      type="button"
                      size="sm"
                      variant={answers[i] === o ? 'default' : 'outline'}
                      className={cn(
                        'h-auto min-h-7 py-1 whitespace-normal',
                        // đáp án đúng: viền xanh; đang chọn (nền màu) thì chỉ thêm vòng để chữ vẫn dễ đọc
                        checked && o === q.answers[0] && (answers[i] === o ? 'ring-2 ring-ok' : 'border-ok text-ok'),
                      )}
                      onClick={() => setText(i, answers[i] === o ? '' : o)}
                    >
                      {o}
                    </Button>
                  ))}
                </div>
              )}
              {checked && (
                <div className="flex flex-col gap-1 text-sm">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {ok ? <CheckCircle2 className="size-4 text-ok" /> : <XCircle className="size-4 text-bad" />}
                    {!ok && (
                      <>
                        Đáp án:{' '}
                        <span className="font-medium text-ok">
                          {q.type === 'fix' ? `${q.wrong} → ${q.answers[0]}` : q.answers[0]}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      className="ml-1 text-muted-foreground hover:text-primary"
                      onClick={() => speak(fullSentence(q), { accent })}
                      aria-label="Nghe cả câu"
                    >
                      <Volume2 className="size-4" />
                    </button>
                  </span>
                  <p className="text-muted-foreground">{q.explanation}</p>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        {checked ? (
          <>
            <span className="text-sm">
              Đúng{' '}
              <span className={cn('font-semibold', score === set.questions.length ? 'text-ok' : 'text-foreground')}>
                {score}/{set.questions.length}
              </span>
              {score < set.questions.length && <span className="text-muted-foreground"> · câu sai đã ghi vào Sổ lỗi</span>}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAnswers({})
                setOrders({})
                setChecked(false)
              }}
            >
              <RotateCcw /> Làm lại
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={!started}>
            <CheckCircle2 /> Kiểm tra
          </Button>
        )}
      </div>
    </form>
  )
}

function FillPrompt({
  q,
  value,
  checked,
  ok,
  onChange,
}: {
  q: Question
  value: string
  checked: boolean
  ok: boolean
  onChange: (v: string) => void
}) {
  const [before, after] = q.prompt.split('___')
  const longest = Math.max(...q.answers.map((a) => a.length), 6)
  return (
    <p className="leading-loose">
      {before}
      {q.type === 'fill' ? (
        <input
          className={cn(
            'mx-1 inline-block h-8 rounded-md border bg-background px-2 align-baseline text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            checked && (ok ? 'border-ok bg-ok-soft/50' : 'border-bad bg-bad-soft/50'),
          )}
          style={{ width: `${Math.min(longest + 4, 36)}ch` }}
          value={value}
          readOnly={checked}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      ) : (
        <span className="mx-1 rounded bg-muted px-2 font-medium">{value || '___'}</span>
      )}
      {after}
      {q.hint && <span className="ml-1 text-sm text-muted-foreground">{q.hint}</span>}
    </p>
  )
}

function OrderPrompt({
  q,
  tokens,
  picked,
  checked,
  ok,
  onChange,
}: {
  q: Question
  tokens: string[]
  picked: number[]
  checked: boolean
  ok: boolean
  onChange: (picked: number[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground">“{q.prompt}”</p>
      <div
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5',
          checked && (ok ? 'border-solid border-ok bg-ok-soft/50' : 'border-solid border-bad bg-bad-soft/50'),
        )}
      >
        {picked.map((t, at) => (
          <button
            key={`${t}-${at}`}
            type="button"
            className="rounded-md bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary hover:bg-primary/20"
            onClick={() => onChange(picked.filter((_, k) => k !== at))}
            disabled={checked}
            title="Bấm để bỏ"
          >
            {tokens[t]}
          </button>
        ))}
        {!picked.length && <span className="text-sm text-muted-foreground">Bấm các từ bên dưới…</span>}
        {!!picked.length && !checked && (
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => onChange(picked.slice(0, -1))}
            aria-label="Bỏ từ cuối"
          >
            <Undo2 className="size-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((tok, t) =>
          picked.includes(t) ? null : (
            <Button
              key={t}
              type="button"
              size="sm"
              variant="outline"
              className="h-7"
              disabled={checked}
              onClick={() => onChange([...picked, t])}
            >
              {tok}
            </Button>
          ),
        )}
      </div>
    </div>
  )
}
