import { CheckCircle2, XCircle } from 'lucide-react'

import { Input } from '#/components/ui/input'
import {
  MULTI_SEPARATOR,
  READING_QUESTION_INSTRUCTION,
  isReadingCorrect,
  isTypedQuestion,
  splitMulti,
} from '#/lib/reading-topics'
import type { ReadingFormat, ReadingQuestionType } from '#/lib/reading-topics'
import { cn } from '#/lib/utils'
import type { ReadingQuestion } from '#/db/schema'

const ROMAN = [
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'viii',
  'ix',
  'x',
  'xi',
  'xii',
]
const roman = (i: number) => ROMAN[i] ?? String(i + 1)

/** phương án đã có nhãn sẵn như đề gốc ("A It was…", "vi What people…", chỉ "C") → không đánh thêm (A), i */
const LABELLED = /^([A-Z]|[ivxl]+)(\s|$)/
const labelled = (options: string[]) =>
  options.length > 0 && options.every((o) => LABELLED.test(o))

/** số câu theo đề: câu chọn nhiều ("Choose TWO letters") chiếm số câu bằng số đáp án */
const width = (q: ReadingQuestion) =>
  q.type === 'multi' ? q.answers.length : 1
function questionNumbers(questions: ReadingQuestion[]) {
  let next = 1
  return questions.map((q) => {
    const from = next
    next += width(q)
    return { from, to: next - 1 }
  })
}
const numberLabel = (n: { from: number; to: number }) =>
  n.to > n.from ? `${n.from}–${n.to}` : String(n.from)

/** nhãn ngắn trước câu khi các dạng xếp xen kẽ (đề cơ bản) */
const SHORT_LABEL: Partial<Record<ReadingQuestionType, string>> = {
  tfng: 'T / F / NG',
  ynng: 'Y / N / NG',
}

interface Group {
  type: string
  /** hướng dẫn của đề gốc; không có thì dùng hướng dẫn mặc định của dạng câu */
  instruction?: string
  /** chỉ số câu đầu tiên trong cả bài */
  from: number
  questions: ReadingQuestion[]
}

/** câu liền nhau cùng dạng (đề gốc: cùng hướng dẫn) thành một nhóm, như đề IELTS / TOEIC */
function groupQuestions(questions: ReadingQuestion[]): Group[] {
  const groups: Group[] = []
  questions.forEach((q, i) => {
    const last = groups.at(-1)
    if (last && last.type === q.type && last.instruction === q.instruction)
      last.questions.push(q)
    else
      groups.push({
        type: q.type,
        instruction: q.instruction,
        from: i,
        questions: [q],
      })
  })
  return groups
}

/**
 * Danh sách câu hỏi. Đề IELTS / TOEIC: chia nhóm "Questions 1–4" kèm hướng dẫn như đề thật,
 * nhóm nối tiêu đề hiện danh sách tiêu đề một lần ở đầu nhóm.
 */
export function ReadingQuestions(props: {
  questions: ReadingQuestion[]
  format: ReadingFormat
  answers: string[]
  checked: boolean
  focus: number | null
  onAnswer: (index: number, answer: string) => void
  onFocus: (index: number) => void
}) {
  const numbers = questionNumbers(props.questions)
  const card = (q: ReadingQuestion, i: number, grouped: boolean) => (
    <QuestionCard
      key={i}
      number={numberLabel(numbers[i])}
      question={q}
      grouped={grouped}
      answer={props.answers[i] ?? ''}
      checked={props.checked}
      focused={props.focus === i}
      onAnswer={(a) => props.onAnswer(i, a)}
      onFocus={() => props.onFocus(i)}
    />
  )

  if (
    props.format === 'standard' &&
    !props.questions.some((q) => q.instruction)
  )
    return (
      <ol className="flex flex-col gap-3">
        {props.questions.map((q, i) => card(q, i, false))}
      </ol>
    )

  return (
    <div className="flex flex-col gap-6">
      {groupQuestions(props.questions).map((g) => (
        <section key={g.from} className="flex flex-col gap-3">
          <header className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">
              Questions{' '}
              {numberLabel({
                from: numbers[g.from].from,
                to: numbers[g.from + g.questions.length - 1].to,
              })}
            </h3>
            <p className="text-sm whitespace-pre-line text-muted-foreground italic">
              {g.instruction ??
                READING_QUESTION_INSTRUCTION[g.type as ReadingQuestionType]}
            </p>
          </header>
          {g.type === 'heading' && (
            <div className="rounded-xl border bg-muted/40 p-3 text-sm">
              <p className="mb-1.5 font-medium">List of Headings</p>
              <ol className="flex flex-col gap-1">
                {g.questions[0].options.map((h, i) => (
                  <li key={h} className="flex gap-2">
                    {!labelled(g.questions[0].options) && (
                      <span className="w-6 shrink-0 text-muted-foreground">
                        {roman(i)}
                      </span>
                    )}
                    {h}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <ol className="flex flex-col gap-3">
            {g.questions.map((q, j) => card(q, g.from + j, true))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function QuestionCard(props: {
  /** số câu hiển thị, vd. "14" hoặc "19–20" */
  number: string
  question: ReadingQuestion
  /** nằm trong nhóm có hướng dẫn chung → không cần nhãn dạng câu */
  grouped: boolean
  answer: string
  checked: boolean
  focused: boolean
  onAnswer: (answer: string) => void
  onFocus: () => void
}) {
  const { question: q, answer, checked } = props
  const hasLabels = labelled(q.options)
  // phương án chỉ là chữ cái (đáp án nằm ở danh sách trong hướng dẫn) → xếp gọn nhiều cột
  const lettersOnly = hasLabels && q.options.every((o) => o.length <= 4)
  const right = checked && isReadingCorrect(q, answer)
  const threeWay = q.type === 'tfng' || q.type === 'ynng'
  const label = props.grouped
    ? undefined
    : SHORT_LABEL[q.type as ReadingQuestionType]

  return (
    <li
      className={cn(
        'min-w-0 flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm sm:p-4',
        checked && (right ? 'border-emerald-500/50' : 'border-destructive/50'),
        props.focused && 'ring-2 ring-amber-400/60',
      )}
    >
      <p className="flex gap-2">
        <span className="font-semibold text-muted-foreground">
          {props.number}.
        </span>
        <span className="flex-1">
          {label && (
            <span className="mr-1 text-xs text-muted-foreground">
              ({label})
            </span>
          )}
          {q.prompt ||
            (q.type === 'multi' &&
              'Chọn các đáp án đúng theo hướng dẫn ở trên')}
        </span>
        {checked &&
          (right ? (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="size-5 shrink-0 text-destructive" />
          ))}
      </p>

      {isTypedQuestion(q.type) ? (
        <Input
          value={answer}
          disabled={checked}
          onChange={(e) => props.onAnswer(e.target.value)}
          placeholder={q.type === 'gap' ? 'Tối đa 2 từ' : 'Tối đa 3 từ'}
          autoComplete="off"
          spellCheck={false}
        />
      ) : q.type === 'multi' ? (
        <MultiChoice
          question={q}
          answer={answer}
          checked={checked}
          onAnswer={props.onAnswer}
        />
      ) : q.type === 'heading' ? (
        <select
          value={answer}
          disabled={checked}
          onChange={(e) => props.onAnswer(e.target.value)}
          className={cn(
            'h-9 w-full rounded-md border bg-transparent px-2 text-sm',
            checked && (right ? 'border-emerald-500' : 'border-destructive'),
          )}
        >
          <option value="">Chọn tiêu đề…</option>
          {q.options.map((o, i) => (
            <option key={o} value={o}>
              {hasLabels ? o : `${roman(i)}. ${o}`}
            </option>
          ))}
        </select>
      ) : (
        <div
          className={cn(
            'grid gap-1.5',
            threeWay && 'grid-cols-3',
            lettersOnly && 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-6',
          )}
        >
          {q.options.map((o, i) => {
            const picked = answer === o
            const isAnswer = checked && o === q.answers[0]
            return (
              <button
                key={o}
                type="button"
                disabled={checked}
                aria-pressed={picked}
                onClick={() => props.onAnswer(o)}
                className={cn(
                  'flex gap-2 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default',
                  (threeWay || lettersOnly) && 'justify-center text-center',
                  !checked &&
                    (picked ? 'border-primary bg-primary/5' : 'hover:bg-muted'),
                  isAnswer && 'border-emerald-500 bg-emerald-500/10',
                  checked &&
                    picked &&
                    !isAnswer &&
                    'border-destructive bg-destructive/10',
                )}
              >
                {/* trắc nghiệm đánh chữ (A)–(D) như đề TOEIC */}
                {!threeWay && !hasLabels && (
                  <span className="text-muted-foreground">
                    ({String.fromCharCode(65 + i)})
                  </span>
                )}
                <span className="min-w-0 break-words">{o}</span>
              </button>
            )
          })}
        </div>
      )}

      {checked && (
        <div className="flex flex-col gap-1.5 border-t pt-2">
          {!right && (
            <p>
              Đáp án:{' '}
              <span className="font-medium">
                {q.type === 'multi' ? q.answers.join(' · ') : q.answers[0]}
              </span>
              {isTypedQuestion(q.type) && answer && (
                <span className="text-muted-foreground">
                  {' '}
                  · bạn điền "{answer}"
                </span>
              )}
            </p>
          )}
          {q.explanation && (
            <p className="text-muted-foreground">{q.explanation}</p>
          )}
          {q.evidence && (
            <button
              type="button"
              onClick={props.onFocus}
              className="w-fit text-left text-xs text-primary hover:underline"
            >
              {props.focused ? 'Ẩn căn cứ trong bài' : 'Xem căn cứ trong bài'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

/** "Choose TWO letters": chọn đúng bằng số đáp án, chọn thêm thì bỏ lựa chọn cũ nhất */
function MultiChoice(props: {
  question: ReadingQuestion
  answer: string
  checked: boolean
  onAnswer: (answer: string) => void
}) {
  const { question: q, checked } = props
  const picked = splitMulti(props.answer)
  const toggle = (o: string) => {
    const next = picked.includes(o)
      ? picked.filter((x) => x !== o)
      : [...picked, o].slice(-q.answers.length)
    // giữ thứ tự phương án để câu trả lời lưu ổn định
    props.onAnswer(
      q.options.filter((x) => next.includes(x)).join(MULTI_SEPARATOR),
    )
  }
  return (
    <div className="grid gap-1.5">
      <p className="text-xs text-muted-foreground">
        Chọn {q.answers.length} đáp án ({picked.length}/{q.answers.length})
      </p>
      {q.options.map((o, i) => {
        const on = picked.includes(o)
        const isAnswer = checked && q.answers.includes(o)
        return (
          <button
            key={o}
            type="button"
            disabled={checked}
            aria-pressed={on}
            onClick={() => toggle(o)}
            className={cn(
              'flex gap-2 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default',
              !checked &&
                (on ? 'border-primary bg-primary/5' : 'hover:bg-muted'),
              isAnswer && 'border-emerald-500 bg-emerald-500/10',
              checked &&
                on &&
                !isAnswer &&
                'border-destructive bg-destructive/10',
            )}
          >
            <span
              className={cn(
                'mt-0.5 size-4 shrink-0 rounded border',
                on && 'border-primary bg-primary',
              )}
            />
            {!labelled(q.options) && (
              <span className="text-muted-foreground">
                {String.fromCharCode(65 + i)}
              </span>
            )}
            <span className="min-w-0 break-words">{o}</span>
          </button>
        )
      })}
    </div>
  )
}
