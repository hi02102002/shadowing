import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  Headphones,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { z } from 'zod'

import { ListeningPlayer } from '#/components/listening-player'
import { ReadingQuestions } from '#/components/reading-questions'
import { ReadingVocab } from '#/components/reading-vocab'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useStoredToggle } from '#/hooks/use-stored-toggle'
import {
  LISTENING_LEVELS,
  LISTENING_SOURCE_INFO,
  LISTENING_SOURCES,
} from '#/lib/listening'
import type { ListeningLevel, ListeningSource } from '#/lib/listening'
import { isReadingCorrect } from '#/lib/reading-topics'
import {
  listeningLibraryQuery,
  listeningQuery,
  listeningsQuery,
} from '#/lib/queries'
import { cn } from '#/lib/utils'
import {
  deleteListening,
  generateListeningQuestions,
  generateListeningTranscript,
  importListening,
  restoreListeningSourceQuestions,
  submitListening,
} from '#/server/fns/listening'

const searchSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
})

export const Route = createFileRoute('/listening')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Luyện nghe · Shadowing' }] }),
  component: ListeningPage,
})

function ListeningPage() {
  const { id } = Route.useSearch()
  return id ? <ListeningExercise id={id} /> : <ListeningLibrary />
}

function ListeningLibrary() {
  const navigate = useNavigate({ from: '/listening' })
  const queryClient = useQueryClient()
  const [source, setSource] = useState<ListeningSource>('cambridge-listening')
  const [level, setLevel] = useState<ListeningLevel | 'all'>('all')
  const [search, setSearch] = useState('')
  const library = useQuery(listeningLibraryQuery(source))
  const history = useQuery(listeningsQuery())
  const open = useMutation({
    mutationFn: (item: NonNullable<typeof library.data>[number]) =>
      item.listeningId
        ? Promise.resolve({ id: item.listeningId })
        : importListening({
            data: {
              source,
              url: item.url,
              level: level === 'all' ? item.levels[0] : level,
            },
          }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: ['listenings'] })
      void queryClient.invalidateQueries({
        queryKey: ['listening-library', source],
      })
      void navigate({ search: { id } })
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteListening({ data: { id } }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['listenings'] }),
  })
  const items = (library.data ?? []).filter(
    (item) =>
      (level === 'all' || item.levels.includes(level)) &&
      item.title.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-3 py-5 sm:gap-8 sm:px-4 sm:py-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Headphones className="size-6" />
          <h1 className="text-2xl font-semibold">Luyện nghe</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Nghe trọn bài hoặc từng section, trả lời câu hỏi và xem lời thoại sau
          khi nộp.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {LISTENING_SOURCES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSource(value)}
              className={cn(
                'rounded-xl border px-3 py-2 text-center text-sm sm:rounded-full sm:py-1.5',
                source === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {LISTENING_SOURCE_INFO[value].label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {LISTENING_SOURCE_INFO[source].detail}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', ...LISTENING_LEVELS] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLevel(value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm',
                level === value
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {value === 'all' ? 'Tất cả cấp' : value}
            </button>
          ))}
          <div className="relative order-first w-full sm:order-none sm:ml-auto sm:w-auto sm:min-w-64">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên bài"
              className="pl-8"
            />
          </div>
        </div>

        {library.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="animate-spin" /> Đang tải mục lục…
          </div>
        ) : library.error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive"
          >
            {library.error.message}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <button
                key={item.url}
                type="button"
                disabled={open.isPending}
                onClick={() => open.mutate(item)}
                className="flex min-h-28 flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left hover:border-primary/50"
              >
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  {item.levelLabel}
                </span>
                <span className="mt-auto text-xs font-medium text-primary">
                  {item.score != null
                    ? `Đã làm · ${item.score} câu đúng`
                    : item.listeningId
                      ? 'Đã mở · học tiếp'
                      : 'Mở bài'}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Lịch sử</h2>
        {!history.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Chưa có bài nghe đã mở.
          </p>
        ) : (
          <div className="divide-y rounded-xl border bg-card">
            {history.data.map((row) => (
              <div key={row.id} className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void navigate({ search: { id: row.id } })}
                >
                  <span className="block truncate font-medium">
                    {row.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.topic} ·{' '}
                    {row.score == null
                      ? 'Chưa nộp'
                      : `${row.score}/${row.total}`}
                  </span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Xoá bài nghe"
                  onClick={() => remove.mutate(row.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ListeningExercise({ id }: { id: number }) {
  const navigate = useNavigate({ from: '/listening' })
  const queryClient = useQueryClient()
  const result = useQuery(listeningQuery(id))
  const data = result.data
  const [exam, setExam] = useStoredToggle('listening.exam-mode')
  const [tab, setTab] = useState<'questions' | 'vocab'>('questions')
  const [answers, setAnswers] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const requested = useRef(false)
  const questions = useMemo(
    () => data?.sections.flatMap((section) => section.questions) ?? [],
    [data?.sections],
  )
  const generate = useMutation({
    mutationFn: (format?: 'standard' | 'ielts') =>
      generateListeningQuestions({
        data: { id, format, count: data?.sections.length === 4 ? 12 : 8 },
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['listening', id] }),
  })
  const restore = useMutation({
    mutationFn: () => restoreListeningSourceQuestions({ data: { id } }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['listening', id] }),
  })
  const transcript = useMutation({
    mutationFn: () => generateListeningTranscript({ data: { id } }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['listening', id] }),
  })
  const submit = useMutation({
    mutationFn: () => submitListening({ data: { id, answers } }),
    onSuccess: () => {
      setChecked(true)
      void queryClient.invalidateQueries({ queryKey: ['listening', id] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
      void queryClient.invalidateQueries({ queryKey: ['activity-stats'] })
    },
  })

  useEffect(() => {
    if (!data) return
    setAnswers(data.answers ?? questions.map(() => ''))
    setChecked(!!data.answers)
  }, [data, questions])
  useEffect(() => {
    requested.current = false
  }, [id])
  useEffect(() => {
    if (
      !data ||
      questions.length ||
      requested.current ||
      !data.sections.some((section) => section.transcript?.length)
    )
      return
    requested.current = true
    generate.mutate(undefined)
  }, [data, questions.length, generate])

  if (result.isLoading)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    )
  if (!data || result.error)
    return (
      <div className="mx-auto max-w-3xl p-8 text-destructive">
        {result.error?.message ?? 'Không tìm thấy bài nghe'}
      </div>
    )
  const total = questions.length
  const score = checked
    ? questions.filter((question, index) =>
        isReadingCorrect(question, answers[index] ?? ''),
      ).length
    : 0
  let offset = 0
  const hasOriginal =
    LISTENING_SOURCE_INFO[data.source as ListeningSource].originalQuestions

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-3 py-5 sm:gap-6 sm:px-4 sm:py-8">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => void navigate({ search: {} })}
          >
            ← Thư viện nghe
          </button>
          <h1 className="mt-1 text-xl font-semibold break-words sm:text-2xl">
            {data.title}
          </h1>
          <p className="text-sm text-muted-foreground">{data.topic}</p>
        </div>
        <a
          href={data.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 text-sm text-primary"
        >
          Nguồn gốc <ExternalLink className="size-3.5" />
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={exam} onCheckedChange={setExam} /> Chế độ thi
        </label>
        <span className="text-xs text-muted-foreground">
          {exam
            ? 'Mỗi section chỉ nghe một lần; ẩn tua, tốc độ và lời thoại.'
            : 'Có thể tua, đổi tốc độ và nghe lại.'}
        </span>
        {checked && (
          <span className="w-full border-t pt-3 font-semibold sm:ml-auto sm:w-auto sm:border-0 sm:pt-0">
            Đúng {score}/{total}
          </span>
        )}
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger className="flex-1 sm:flex-none" value="questions">
            Bài nghe
          </TabsTrigger>
          <TabsTrigger className="flex-1 sm:flex-none" value="vocab">
            Từ vựng
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'vocab' ? (
        <ReadingVocab id={id} kind="listening" onLocate={() => {}} />
      ) : (
        <div className="flex flex-col gap-8">
          {data.sections.map((section, sectionIndex) => {
            const from = offset
            offset += section.questions.length
            return (
              <section
                key={`${section.title}-${sectionIndex}`}
                className="min-w-0 flex flex-col gap-4 rounded-2xl border bg-card/40 p-3 sm:p-5"
              >
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <ListeningPlayer
                  media={section.media}
                  src={
                    section.media?.kind === 'audio'
                      ? `/api/listening-audio/${id}/${sectionIndex}`
                      : undefined
                  }
                  exam={exam}
                  errorMessage={
                    data.source === 'breaking-news'
                      ? 'Level này không có audio.'
                      : undefined
                  }
                />
                {!!section.questions.length && (
                  <ReadingQuestions
                    questions={section.questions}
                    format={data.format as 'standard' | 'ielts'}
                    answers={answers.slice(
                      from,
                      from + section.questions.length,
                    )}
                    checked={checked}
                    focus={null}
                    onFocus={() => {}}
                    onAnswer={(index, answer) =>
                      setAnswers((old) =>
                        old.map((value, i) =>
                          i === from + index ? answer : value,
                        ),
                      )
                    }
                  />
                )}
                {checked && section.transcript?.length && (
                  <details
                    open
                    className="min-w-0 rounded-xl border bg-background p-3 sm:p-4"
                  >
                    <summary className="cursor-pointer font-medium">
                      Lời thoại
                    </summary>
                    <div className="mt-3 flex min-w-0 flex-col gap-2 text-sm leading-6 break-words">
                      {section.transcript.map((line, i) => (
                        <p key={i}>
                          <TranscriptLine text={line} />
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            )
          })}

          {!total && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {generate.isPending ? (
                <>
                  <Loader2 className="mx-auto mb-2 animate-spin" />
                  AI đang soạn câu hỏi…
                </>
              ) : (
                <>
                  <p>{generate.error?.message ?? 'Bài chưa có câu hỏi.'}</p>
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={() => generate.mutate(undefined)}
                  >
                    <Sparkles /> Soạn câu hỏi bằng AI
                  </Button>
                </>
              )}
            </div>
          )}
          {(submit.error || restore.error || generate.error) && total > 0 && (
            <p role="alert" className="text-sm text-destructive">
              {(submit.error || restore.error || generate.error)?.message}
            </p>
          )}
          {data.source === 'tactics' &&
            data.sections.some((section) => !section.transcript?.length) && (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <p>
                  Tactics chưa có lời thoại sẵn. Có thể tạo bằng Whisper đã cấu
                  hình trong Cài đặt.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={transcript.isPending}
                  onClick={() => transcript.mutate()}
                >
                  {transcript.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}{' '}
                  Tạo lời thoại bằng Whisper
                </Button>
                {transcript.error && (
                  <p className="mt-2 text-destructive">
                    {transcript.error.message}
                  </p>
                )}
              </div>
            )}
          {!!total && (
            <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-background/95 py-3 backdrop-blur sm:flex sm:flex-wrap">
              {checked ? (
                <Button
                  className="col-span-2 w-full sm:col-span-1 sm:w-auto"
                  variant="outline"
                  onClick={() => {
                    setAnswers(questions.map(() => ''))
                    setChecked(false)
                  }}
                >
                  <RotateCcw /> Làm lại
                </Button>
              ) : (
                <Button
                  className="col-span-2 w-full sm:min-w-40 sm:w-auto"
                  disabled={submit.isPending}
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending && <Loader2 className="animate-spin" />} Nộp
                  bài
                </Button>
              )}
              {hasOriginal && (
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate()}
                >
                  {restore.isPending && <Loader2 className="animate-spin" />} Đề
                  gốc
                </Button>
              )}
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                disabled={generate.isPending}
                onClick={() =>
                  generate.mutate(
                    data.format === 'ielts' ? 'ielts' : 'standard',
                  )
                }
              >
                <Sparkles /> Soạn câu hỏi khác
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TranscriptLine({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\[\[[\s\S]*?]])/g)
        .filter(Boolean)
        .map((part, index) =>
          part.startsWith('[[') ? (
            <mark
              key={index}
              className="rounded bg-amber-200 px-1 text-amber-950"
            >
              {part.slice(2, -2)}
            </mark>
          ) : (
            part
          ),
        )}
    </>
  )
}
