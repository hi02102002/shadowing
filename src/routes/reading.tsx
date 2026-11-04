import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpenText, ClipboardPaste, Eraser, ExternalLink, Library, Loader2, RotateCcw, Sparkles, Trash2, Volume2, } from 'lucide-react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAccent } from '#/hooks/use-app-settings'
import { activityStatsQuery, mistakesQueryKey, readingLibraryQuery, readingQuery, readingsQuery, statsQuery } from '#/lib/queries'
import {
  LIBRARY_SOURCES,
  CUSTOM_TEXT_MAX,
  CUSTOM_TEXT_MIN,
  READING_COUNTS,
  READING_FORMATS,
  READING_FORMAT_INFO,
  READING_LEVELS,
  READING_LEVEL_LABEL,
  READING_QUESTION_TYPE_LABEL,
  READING_SOURCE_INFO,
  READING_TOPICS,
  SOURCES_WITH_ANSWERS,
  isReadingCorrect,
  splitPastedText,
} from '#/lib/reading-topics'
import type { AiQuestionType, LibrarySource, ReadingFormat, ReadingLevel, ReadingSource } from '#/lib/reading-topics'
import { speakLong } from '#/lib/speech'
import { cn } from '#/lib/utils'
import {
  createCustomReading,
  deleteReading,
  generateReading,
  generateReadingQuestions,
  importReading,
  restoreSourceQuestions,
  saveReadingHighlights,
  submitReading,
} from '#/server/fns/reading'
import type { ReadingLibraryItem } from '#/server/fns/reading'
import type { ReadingHighlight, ReadingQuestion } from '#/db/schema'
import { ReadingPassage } from '#/components/reading-passage'
import { ReadingQuestions } from '#/components/reading-questions'
import { LessonChunks } from '#/components/lesson-chunks'
import { ReadingVocab } from '#/components/reading-vocab'

const SETUP_TABS = ['library', 'ai', 'paste'] as const
type SetupTab = (typeof SETUP_TABS)[number]

const searchSchema = z.object({
  id: z.number().int().optional().catch(undefined),
  mode: z.enum(SETUP_TABS).optional().catch(undefined),
  /** nguồn và trình độ đang xem trong thư viện */
  src: z.enum(LIBRARY_SOURCES).optional().catch(undefined),
  lv: z.enum(READING_LEVELS).optional().catch(undefined),
})

export const Route = createFileRoute('/reading')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Đọc hiểu · Shadowing' }] }),
  component: ReadingPage,
})

function ReadingPage() {
  const { id } = Route.useSearch()
  return id ? <ReadingView key={id} id={id} /> : <Setup />
}

const GROUPS = [...new Set(READING_TOPICS.map((t) => t.group))]

const chip = (on: boolean) =>
  cn(
    'rounded-full border px-3 py-1 text-sm transition-colors',
    on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
  )

/** tạo bài mới rồi mở luôn */
function useGenerate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { topic: string; level: ReadingLevel; format: ReadingFormat; count: number; types?: AiQuestionType[] }) => generateReading({ data: input }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: readingsQuery().queryKey })
      void navigate({ to: '/reading', search: { id } })
    },
  })
}

function Setup() {
  const search = Route.useSearch()
  const { mode = 'library' } = search
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: history = [] } = useQuery(readingsQuery())
  const remove = useMutation({
    mutationFn: (id: number) => deleteReading({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: readingsQuery().queryKey })
      void queryClient.invalidateQueries({ queryKey: ['reading-library'] })
    },
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BookOpenText className="size-6 text-primary" /> Đọc hiểu
        </h1>
        <p className="text-sm text-muted-foreground">
          Chọn bài từ thư viện bài đọc chia cấp độ hoặc để AI viết bài theo chủ đề của bạn, kèm câu hỏi kiểu IELTS. Nhấp đúp vào từ để tra nghĩa; nộp bài để
          xem đáp án, giải thích và câu làm căn cứ trong bài.
        </p>
      </header>

      <Tabs value={mode} onValueChange={(v) => void navigate({ to: '/reading', search: { ...search, mode: v as SetupTab }, replace: true })}>
        <TabsList>
          <TabsTrigger value="library">
            <Library /> Thư viện bài đọc
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles /> AI viết bài
          </TabsTrigger>
          <TabsTrigger value="paste">
            <ClipboardPaste /> Dán bài
          </TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="mt-4">
          <LibraryBrowser />
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <AiForm />
        </TabsContent>
        <TabsContent value="paste" className="mt-4">
          <PasteForm />
        </TabsContent>
      </Tabs>

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Bài đã đọc</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {history.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link to="/reading" search={{ id: r.id }} className="min-w-0 flex-1 truncate text-foreground no-underline hover:underline">
                  {r.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {READING_SOURCE_INFO[r.source as ReadingSource].label} · {r.level} ·{' '}
                  {r.score != null ? `${r.score}/${r.total} câu đúng` : 'chưa làm'} · {r.createdAt.toLocaleDateString('vi-VN')}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  title="Xoá bài này"
                  onClick={() => remove.mutate(r.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const PAGE = 30

/** duyệt mục lục một nguồn, lọc theo cấp độ và tên bài; bấm bài để tải về rồi mở */
function LibraryBrowser() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = Route.useSearch()
  const { src: source = 'breaking-news', lv: level = 'B1' } = params
  const pick = (next: { src?: LibrarySource; lv?: ReadingLevel }) => {
    setShown(PAGE)
    void navigate({ to: '/reading', search: { ...params, ...next }, replace: true })
  }
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const { data = [], isLoading, error } = useQuery(readingLibraryQuery(source))
  const open = useMutation({
    mutationFn: (item: ReadingLibraryItem) =>
      importReading({ data: { source: item.source, url: item.url, level: item.levels.includes(level) ? level : item.levels[0], levelLabel: item.levelLabel } }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: readingsQuery().queryKey })
      void queryClient.invalidateQueries({ queryKey: ['reading-library'] })
      void navigate({ to: '/reading', search: { id } })
    },
  })

  const q = query.trim().toLowerCase()
  const items = data.filter((i) => i.levels.includes(level) && (!q || i.title.toLowerCase().includes(q)))
  const info = READING_SOURCE_INFO[source]

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap gap-2">
        {LIBRARY_SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={source === s}
            onClick={() => pick({ src: s })}
            className={chip(source === s)}
          >
            {READING_SOURCE_INFO[s].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {info.detail}.{' '}
        <a href={info.home} target="_blank" rel="noreferrer">
          Trang gốc
        </a>
        . {SOURCES_WITH_ANSWERS.includes(source) ? 'Dùng câu hỏi và đáp án gốc.' : 'Câu hỏi do AI soạn từ bài gốc.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Trình độ</span>
        {READING_LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={level === l}
            onClick={() => pick({ lv: l })}
            className={chip(level === l)}
          >
            {l}
          </button>
        ))}
      </div>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên bài" />

      {open.error && (
        <p role="alert" className="text-sm text-destructive">
          {open.error.message}
        </p>
      )}
      {isLoading ? (
        <Loader2 className="mx-auto my-6 animate-spin text-muted-foreground" />
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : items.length ? (
        <ul className="-mx-2 flex flex-col">
          {items.slice(0, shown).map((i) => (
            <li key={i.url}>
              <button
                type="button"
                disabled={open.isPending}
                onClick={() => (i.readingId ? void navigate({ to: '/reading', search: { id: i.readingId } }) : open.mutate(i))}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 truncate">{i.title}</span>
                {open.isPending && open.variables.url === i.url && <Loader2 className="size-4 animate-spin" />}
                {i.readingId && (
                  <span className="shrink-0 text-xs text-primary">{i.score != null ? `đã làm · ${i.score} đúng` : 'đã mở'}</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {i.levelLabel}
                  {i.date && ` · ${i.date}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Không có bài nào ở trình độ này{q && ' khớp với từ khoá'}.</p>
      )}
      {items.length > shown && (
        <Button variant="outline" onClick={() => setShown(shown + PAGE)}>
          Xem thêm ({items.length - shown} bài)
        </Button>
      )}
    </div>
  )
}

/** dán bài của mình (báo, đề thi, tài liệu học…): lưu lại rồi mở, AI soạn câu hỏi khi mở bài */
function PasteForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [level, setLevel] = useState<ReadingLevel>('B1')
  const [format, setFormat] = useState<ReadingFormat>('standard')
  const create = useMutation({
    mutationFn: () => createCustomReading({ data: { title, text, level, format } }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: readingsQuery().queryKey })
      void navigate({ to: '/reading', search: { id } })
    },
  })
  const length = text.trim().length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const paragraphs = splitPastedText(text).length

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate()
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tiêu đề <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Vd. The future of electric cars" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Bài đọc tiếng Anh
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={CUSTOM_TEXT_MAX}
          rows={12}
          className="font-normal"
          placeholder="Dán bài báo, đoạn trong đề thi, tài liệu học… Mỗi đoạn cách nhau một dòng trống."
        />
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">
        {words} từ · {paragraphs} đoạn
        {length > 0 && length < CUSTOM_TEXT_MIN && ` · cần ít nhất ${CUSTOM_TEXT_MIN} ký tự để ra câu hỏi`}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Trình độ</span>
        {READING_LEVELS.map((l) => (
          <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={chip(level === l)}>
            {READING_LEVEL_LABEL[l]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Dạng đề</span>
          {READING_FORMATS.map((f) => (
            <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)} className={chip(format === f)}>
              {READING_FORMAT_INFO[f].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{READING_FORMAT_INFO[format].detail}</p>
      </div>

      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {create.error.message}
        </p>
      )}
      <Button type="submit" disabled={create.isPending || length < CUSTOM_TEXT_MIN}>
        {create.isPending ? <Loader2 className="animate-spin" /> : <BookOpenText />} Đọc bài này
      </Button>
    </form>
  )
}

function AiForm() {
  const [topic, setTopic] = useState(READING_TOPICS[0].topic)
  const [custom, setCustom] = useState('')
  const [level, setLevel] = useState<ReadingLevel>('B1')
  const [count, setCount] = useState(8)
  const [format, setFormat] = useState<ReadingFormat>('standard')
  const [types, setTypes] = useState<AiQuestionType[]>([...READING_FORMAT_INFO.standard.types])
  const generate = useGenerate()
  const chosen = custom.trim() || topic
  const formatTypes = READING_FORMAT_INFO[format].types

  return (
    <form
      className="flex flex-col gap-5 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault()
        generate.mutate({ topic: chosen, level, format, count, types })
      }}
    >
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">Chủ đề</span>
        {GROUPS.map((g) => (
          <div key={g} className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{g}</span>
            <div className="flex flex-wrap gap-1.5">
              {READING_TOPICS.filter((t) => t.group === g).map((t) => (
                <button
                  key={t.topic}
                  type="button"
                  aria-pressed={!custom.trim() && topic === t.topic}
                  onClick={() => {
                    setTopic(t.topic)
                    setCustom('')
                  }}
                  className={chip(!custom.trim() && topic === t.topic)}
                >
                  {t.topic}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200} placeholder="Hoặc tự nhập chủ đề, vd. Coffee culture in Vietnam" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Trình độ</span>
        {READING_LEVELS.map((l) => (
          <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={chip(level === l)}>
            {READING_LEVEL_LABEL[l]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Số câu hỏi</span>
        {READING_COUNTS.map((n) => (
          <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={chip(count === n)}>
            {n}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Dạng đề</span>
          {READING_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => {
                setFormat(f)
                setTypes([...READING_FORMAT_INFO[f].types])
              }}
              className={chip(format === f)}
            >
              {READING_FORMAT_INFO[f].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{READING_FORMAT_INFO[format].detail}</p>
      </div>

      {formatTypes.length > 1 && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Dạng câu hỏi</span>
        {formatTypes.map((t) => {
          const on = types.includes(t)
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              // giữ ít nhất một dạng
              onClick={() => setTypes(on ? (types.length > 1 ? types.filter((x) => x !== t) : types) : [...types, t])}
              className={chip(on)}
            >
              {READING_QUESTION_TYPE_LABEL[t]}
            </button>
          )
        })}
      </div>
      )}

      {generate.error && (
        <p role="alert" className="text-sm text-destructive">
          {generate.error.message}
        </p>
      )}
      <Button type="submit" disabled={generate.isPending}>
        {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {generate.isPending ? 'AI đang viết bài…' : 'Tạo bài đọc'}
      </Button>
    </form>
  )
}

type SideTab = 'questions' | 'vocab' | 'chunks'

function ReadingView({ id }: { id: number }) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery(readingQuery(id))
  const [accent] = useAccent()
  const [answers, setAnswers] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [side, setSide] = useState<SideTab>('questions')
  // câu hỏi đang xem căn cứ, và đoạn đang tô trong bài (căn cứ của câu hỏi hoặc câu chứa từ ở tab Từ vựng)
  const [focus, setFocus] = useState<number | null>(null)
  const [highlight, setHighlight] = useState('')
  const markRef = useRef<HTMLElement>(null)
  // chỗ người học tự tô màu, lưu ngay mỗi lần đổi
  const [marks, setMarks] = useState<ReadingHighlight[]>([])
  const marksLoaded = useRef(false)
  const saveMarks = useMutation({ mutationFn: (highlights: ReadingHighlight[]) => saveReadingHighlights({ data: { id, highlights } }) })
  const changeMarks = (next: ReadingHighlight[]) => {
    setMarks(next)
    saveMarks.mutate(next)
  }
  const generate = useGenerate()
  // bộ câu hỏi đang làm: refetch giữ nguyên tham chiếu khi câu hỏi không đổi nên không ghi đè bài đang làm
  const loaded = useRef<ReadingQuestion[] | null>(null)

  useEffect(() => {
    if (!data || marksLoaded.current) return
    marksLoaded.current = true
    setMarks(data.highlights)
  }, [data])

  // mở lại bài đã làm thì hiện luôn kết quả lần nộp gần nhất; có bộ câu hỏi mới thì làm lại từ đầu
  useEffect(() => {
    if (!data || loaded.current === data.questions) return
    loaded.current = data.questions
    setAnswers(data.answers ?? data.questions.map(() => ''))
    setChecked(!!data.answers)
    setFocus(null)
    setHighlight('')
  }, [data])

  const makeQuestions = useMutation({
    mutationFn: (format?: ReadingFormat) =>
      generateReadingQuestions({ data: { id, format, count: data?.questions.length || 8 } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: readingQuery(id).queryKey })
      void queryClient.invalidateQueries({ queryKey: readingsQuery().queryKey })
    },
  })
  const restore = useMutation({
    mutationFn: () => restoreSourceQuestions({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: readingQuery(id).queryKey })
      void queryClient.invalidateQueries({ queryKey: readingsQuery().queryKey })
    },
  })
  const needsQuestions = !!data && !data.questions.length
  const { mutate: makeFirstQuestions, isIdle } = makeQuestions

  // bài vừa lấy từ thư viện chưa có câu hỏi: AI soạn ngay khi mở, người học đọc bài trong lúc chờ
  useEffect(() => {
    if (needsQuestions && isIdle) makeFirstQuestions(undefined)
  }, [needsQuestions, isIdle, makeFirstQuestions])

  useEffect(() => {
    markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight])

  const submit = useMutation({
    mutationFn: () => submitReading({ data: { id, answers } }),
    onSuccess: () => {
      setChecked(true)
      setFocus(null)
      setHighlight('')
      void queryClient.invalidateQueries({ queryKey: readingQuery(id).queryKey })
      void queryClient.invalidateQueries({ queryKey: readingsQuery().queryKey })
      void queryClient.invalidateQueries({ queryKey: statsQuery().queryKey })
      void queryClient.invalidateQueries({ queryKey: activityStatsQuery().queryKey })
      void queryClient.invalidateQueries({ queryKey: mistakesQueryKey })
    },
  })

  if (isLoading) return <Loader2 className="mx-auto my-16 animate-spin text-muted-foreground" />
  if (error || !data)
    return (
      <p role="alert" className="mx-auto max-w-3xl px-4 py-8 text-sm text-destructive">
        {error?.message ?? 'Không tìm thấy bài đọc'}
      </p>
    )

  const format = data.format as ReadingFormat
  const total = data.questions.length
  const score = checked ? data.questions.filter((q, i) => isReadingCorrect(q, answers[i] ?? '')).length : 0
  const unanswered = answers.filter((a) => !a.trim()).length
  const busy = makeQuestions.isPending || generate.isPending || restore.isPending
  // bài sách / đề gốc: câu gốc không có lời giải thích, câu AI soạn thì có
  const hasOriginal = SOURCES_WITH_ANSWERS.some((s) => s === data.source)
  const usingOriginal = hasOriginal && data.questions.length > 0 && data.questions.every((q) => !q.explanation)
  const actionError = generate.error ?? restore.error ?? (needsQuestions ? null : makeQuestions.error)

  const locate = (text: string) => {
    setFocus(null)
    setHighlight(highlight === text ? '' : text)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <Link to="/reading" className="flex w-fit items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground">
        <ArrowLeft className="size-4" /> Bài khác
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        {/* màn rộng: bài đọc đứng yên bên trái (bài dài thì cuộn trong khung), câu hỏi cuộn theo trang */}
        <article className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-3 lg:[scrollbar-width:thin]">
          <header className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {/* bài thư viện: topic đã gồm tên nguồn và cấp độ */}
              {data.source === 'ai' ? `${READING_LEVEL_LABEL[data.level as ReadingLevel]} · ${data.topic}` : data.topic}
            </p>
            <h1 className="text-2xl font-semibold text-balance">{data.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Button size="sm" variant="outline" onClick={() => speakLong(data.paragraphs.join(' '), { accent })}>
                <Volume2 /> Nghe cả bài
              </Button>
              {data.sourceUrl && (
                <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                  Bài gốc <ExternalLink className="size-3" />
                </a>
              )}
              {data.source === 'onestop' && <span>Vajjala &amp; Lučić (2018), CC BY-SA 4.0</span>}
              {data.source !== 'ai' && <span>{usingOriginal ? 'Câu hỏi và đáp án gốc' : 'Câu hỏi do AI soạn'}</span>}
              {marks.length > 0 && (
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => changeMarks([])}>
                  <Eraser className="size-3" /> Xoá hết chỗ tô
                </button>
              )}
              {saveMarks.isError && <span className="text-destructive">Chưa lưu được chỗ tô</span>}
            </div>
            <p className="text-xs text-muted-foreground">Bôi đen chữ để tô màu, nhấp đúp vào từ để tra nghĩa.</p>
          </header>

          <ReadingPassage
            paragraphs={data.paragraphs}
            // đề IELTS gốc đã tự ghi chữ đoạn khi cần
            lettered={format === 'ielts' && data.source !== 'cambridge-ielts'}
            accent={accent}
            quote={highlight}
            quoteRef={markRef}
            highlights={marks}
            onHighlightsChange={changeMarks}
          />

          {data.glossary.length > 0 && (
            <details className="rounded-xl border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-medium">Từ khó trong bài ({data.glossary.length})</summary>
              <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
                {data.glossary.map((g) => (
                  <div key={g.en} className="contents">
                    <dt className="font-medium">{g.en}</dt>
                    <dd className="text-muted-foreground">{g.vi}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </article>

        <aside className="flex flex-col gap-4">
          <div className="sticky top-14 z-10 -mx-1 flex flex-col gap-2 bg-background/95 px-1 py-2 backdrop-blur">
            <div className="flex items-center gap-2">
              <Tabs value={side} onValueChange={(v) => setSide(v as SideTab)}>
                <TabsList>
                  <TabsTrigger value="questions">Câu hỏi</TabsTrigger>
                  <TabsTrigger value="vocab">Từ vựng</TabsTrigger>
                  <TabsTrigger value="chunks">Chunks</TabsTrigger>
                </TabsList>
              </Tabs>
              {side === 'questions' && !!total && (
                <span className="ml-auto text-sm text-muted-foreground">
                  {checked ? (
                    <span className="font-medium text-foreground">
                      Đúng {score}/{total}
                    </span>
                  ) : (
                    `Đã làm ${total - unanswered}/${total}`
                  )}
                </span>
              )}
            </div>
            {side === 'questions' && (
              <>
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground">Dạng đề</span>
                  {hasOriginal && (
                    <button
                      type="button"
                      aria-pressed={usingOriginal}
                      disabled={busy || usingOriginal}
                      title="Câu hỏi và đáp án gốc của sách / đề"
                      onClick={() => restore.mutate()}
                      className={cn(chip(usingOriginal), 'px-2.5 py-0.5 disabled:opacity-100')}
                    >
                      {restore.isPending && <Loader2 className="mr-1 inline size-3 animate-spin" />}
                      Đề gốc
                    </button>
                  )}
                  {READING_FORMATS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={!usingOriginal && format === f}
                      disabled={busy || needsQuestions}
                      title={!usingOriginal && f === format ? READING_FORMAT_INFO[f].detail : `AI soạn lại câu hỏi theo dạng ${READING_FORMAT_INFO[f].label}`}
                      onClick={() => (usingOriginal || f !== format) && makeQuestions.mutate(f)}
                      className={cn(chip(!usingOriginal && format === f), 'px-2.5 py-0.5 disabled:opacity-60')}
                    >
                      {makeQuestions.isPending && makeQuestions.variables === f && <Loader2 className="mr-1 inline size-3 animate-spin" />}
                      {READING_FORMAT_INFO[f].label}
                    </button>
                  ))}
                </div>
                {!!total && (
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', checked ? 'bg-emerald-500' : 'bg-primary')}
                      style={{ width: `${((checked ? score : total - unanswered) / total) * 100}%` }}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {side === 'chunks' ? (
            <LessonChunks text={data.paragraphs.join('\n')} onLocate={locate} />
          ) : side === 'vocab' ? (
            <ReadingVocab id={id} onLocate={locate} />
          ) : (
            <>
              {needsQuestions && (
                <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                  {makeQuestions.isError ? (
                    <>
                      <p role="alert" className="text-destructive">
                        {makeQuestions.error.message}
                      </p>
                      <Button variant="outline" onClick={() => makeQuestions.mutate(undefined)}>
                        <RotateCcw /> Thử lại
                      </Button>
                    </>
                  ) : (
                    <>
                      <Loader2 className="animate-spin" />
                      AI đang soạn câu hỏi {READING_FORMAT_INFO[format].label}, bạn cứ đọc bài trước…
                    </>
                  )}
                </div>
              )}

              <ReadingQuestions
                questions={data.questions}
                format={format}
                answers={answers}
                checked={checked}
                focus={focus}
                onAnswer={(i, a) => setAnswers((prev) => prev.map((x, j) => (j === i ? a : x)))}
                onFocus={(i) => {
                  const off = focus === i
                  setFocus(off ? null : i)
                  setHighlight(off ? '' : data.questions[i].evidence)
                }}
              />

              {submit.error && (
                <p role="alert" className="text-sm text-destructive">
                  {submit.error.message}
                </p>
              )}
              {actionError && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError.message}
                </p>
              )}
              {needsQuestions ? null : checked ? (
                <div className="sticky bottom-0 -mx-1 flex flex-wrap gap-2 bg-background/95 px-1 py-3 backdrop-blur">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAnswers(data.questions.map(() => ''))
                      setChecked(false)
                      setFocus(null)
                      setHighlight('')
                    }}
                  >
                    <RotateCcw /> Làm lại
                  </Button>
                  {data.source === 'ai' ? (
                    <Button
                      disabled={busy}
                      onClick={() => generate.mutate({ topic: data.topic, level: data.level as ReadingLevel, format, count: total })}
                    >
                      {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Bài mới cùng chủ đề
                    </Button>
                  ) : (
                    <Button disabled={busy} onClick={() => makeQuestions.mutate(undefined)}>
                      {makeQuestions.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Soạn câu hỏi khác
                    </Button>
                  )}
                </div>
              ) : (
                <div className="sticky bottom-0 -mx-1 bg-background/95 px-1 py-3 backdrop-blur">
                  <Button className="w-full" disabled={submit.isPending || busy} onClick={() => submit.mutate()}>
                    {submit.isPending && <Loader2 className="animate-spin" />}
                    Nộp bài{unanswered ? ` (còn ${unanswered} câu trống)` : ''}
                  </Button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
