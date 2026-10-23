import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronRight,
  Snail,
  Speech,
  Volume2,
  XCircle,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAccent } from '#/hooks/use-app-settings'
import {
  exampleWord,
  GROUP_LABEL,
  IPA_SOUNDS,
  splitExample,
} from '#/lib/ipa-sounds'
import type { IpaSound, SoundGroup } from '#/lib/ipa-sounds'
import type { Accent } from '#/lib/speech'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { wordsIpa } from '#/server/fns/dictionary'

export const Route = createFileRoute('/ipa')({
  head: () => ({ meta: [{ title: 'Luyện IPA · Shadowing' }] }),
  component: IpaPage,
})

const GROUPS = Object.keys(GROUP_LABEL) as SoundGroup[]
const ALL_WORDS = [
  ...new Set(IPA_SOUNDS.flatMap((s) => s.examples.map(exampleWord))),
]

/** phiên âm mọi từ ví dụ trong một lần gọi; key 'ipa' → tự tải lại khi đổi giọng */
function useExampleIpa() {
  const { data } = useQuery({
    queryKey: ['ipa', 'chart'],
    queryFn: () => wordsIpa({ data: { words: ALL_WORDS } }),
    staleTime: Infinity,
  })
  return useMemo(
    () =>
      data
        ? new Map(ALL_WORDS.map((w, i) => [w, data[i]] as const))
        : undefined,
    [data],
  )
}

function IpaPage() {
  const [accent, chooseAccent] = useAccent()
  const ipa = useExampleIpa()
  // âm chỉ có ở giọng kia (vd. /ɒ/ với giọng Mỹ) thì ẩn đi
  const sounds = useMemo(
    () => IPA_SOUNDS.filter((s) => !s.only || s.only === accent),
    [accent],
  )

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Speech className="size-6 text-primary" />
            Luyện IPA
          </h1>
          <p className="text-sm text-muted-foreground">
            Bấm vào từng âm để nghe từ ví dụ và mẹo phát âm, rồi sang tab Luyện
            nghe để kiểm tra tai mình.
          </p>
        </div>
        <div className="flex rounded-lg border p-0.5 text-sm">
          {(['us', 'uk'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => chooseAccent(a)}
              className={cn(
                'rounded-md px-3 py-1 text-muted-foreground transition-colors',
                accent === a && 'bg-primary text-primary-foreground',
              )}
            >
              {a === 'us' ? 'Giọng Mỹ' : 'Giọng Anh'}
            </button>
          ))}
        </div>
      </header>

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Bảng âm</TabsTrigger>
          <TabsTrigger value="quiz">Luyện nghe</TabsTrigger>
        </TabsList>
        <TabsContent value="chart" className="mt-2">
          <SoundChart sounds={sounds} accent={accent} ipa={ipa} />
        </TabsContent>
        <TabsContent value="quiz" className="mt-2">
          <ListeningQuiz sounds={sounds} accent={accent} ipa={ipa} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type IpaMap = Map<string, string | null> | undefined

function SoundChart({
  sounds,
  accent,
  ipa,
}: {
  sounds: IpaSound[]
  accent: Accent
  ipa: IpaMap
}) {
  const [selectedId, setSelectedId] = useState(sounds[0].id)
  const selected = sounds.find((s) => s.id === selectedId) ?? sounds[0]

  const select = (s: IpaSound) => {
    setSelectedId(s.id)
    speak(exampleWord(s.examples[0]), { accent })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-5">
        {GROUPS.map((group) => (
          <section key={group}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              {GROUP_LABEL[group]}
            </h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {sounds
                .filter((s) => s.group === group)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => select(s)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-lg border bg-card px-2 py-2.5 transition-colors hover:border-primary/60 hover:bg-muted',
                      s.id === selected.id &&
                        'border-primary bg-primary/10 hover:bg-primary/10',
                    )}
                  >
                    <span className="ipa text-xl font-medium">
                      /{s.symbol[accent]}/
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {exampleWord(s.examples[0])}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-20">
        <div className="flex items-baseline justify-between gap-2">
          <span className="ipa text-4xl font-semibold text-primary">
            /{selected.symbol[accent]}/
          </span>
          <span className="text-xs text-muted-foreground">
            {GROUP_LABEL[selected.group]}
          </span>
        </div>
        <p className="mt-3 text-sm">{selected.tip}</p>
        <ul className="mt-4 flex flex-col gap-1.5">
          {selected.examples.map((ex) => {
            const word = exampleWord(ex)
            return (
              <li key={ex}>
                <button
                  type="button"
                  onClick={() => speak(word, { accent })}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <Volume2 className="size-4 shrink-0 text-muted-foreground" />
                  <MarkedWord example={ex} className="w-24" />
                  <span className="ipa text-sm text-muted-foreground">
                    {ipa?.get(word) ? `/${ipa.get(word)}/` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}

function MarkedWord({
  example,
  className,
}: {
  example: string
  className?: string
}) {
  const { before, mark, after } = splitExample(example)
  return (
    <span className={cn('font-medium', className)}>
      {before}
      <span className="text-primary underline underline-offset-4">{mark}</span>
      {after}
    </span>
  )
}

interface Question {
  sound: IpaSound
  example: string
  options: IpaSound[]
}

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Câu hỏi: nghe một từ, chọn âm có trong từ đó.
 * Chỉ hỏi từ mà phiên âm thật sự chứa âm đích, và loại phương án nhiễu cũng có mặt trong từ
 * (vd. hỏi /p/ trong "pen" thì không đưa /n/ làm phương án) → luôn chỉ có một đáp án đúng.
 */
function makeQuestion(
  sounds: IpaSound[],
  accent: Accent,
  ipa: NonNullable<IpaMap>,
  group: SoundGroup | 'all',
  prev?: Question,
): Question | null {
  const pool = sounds.filter((s) => group === 'all' || s.group === group)
  const candidates = pool.flatMap((sound) =>
    sound.examples
      .filter((ex) => ipa.get(exampleWord(ex))?.includes(sound.symbol[accent]))
      .filter((ex) => ex !== prev?.example)
      .map((example) => ({ sound, example })),
  )
  if (!candidates.length) return null
  const { sound, example } =
    candidates[Math.floor(Math.random() * candidates.length)]
  const wordIpa = ipa.get(exampleWord(example)) ?? ''
  const distractors = shuffle(
    sounds.filter(
      (s) =>
        s.group === sound.group &&
        s.id !== sound.id &&
        !wordIpa.includes(s.symbol[accent]),
    ),
  ).slice(0, 3)
  return { sound, example, options: shuffle([sound, ...distractors]) }
}

function ListeningQuiz({
  sounds,
  accent,
  ipa,
}: {
  sounds: IpaSound[]
  accent: Accent
  ipa: IpaMap
}) {
  const [group, setGroup] = useState<SoundGroup | 'all'>('all')
  const [question, setQuestion] = useState<Question | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })

  const next = (g = group) => {
    if (!ipa) return
    const q = makeQuestion(sounds, accent, ipa, g, question ?? undefined)
    setQuestion(q)
    setPicked(null)
    if (q) speak(exampleWord(q.example), { accent })
  }

  // câu đầu tiên khi phiên âm đã tải; đổi giọng → câu mới theo giọng đó
  useEffect(() => {
    if (!ipa) return
    setQuestion(makeQuestion(sounds, accent, ipa, group))
    setPicked(null)
  }, [ipa, sounds, accent])

  const chooseGroup = (g: SoundGroup | 'all') => {
    setGroup(g)
    next(g)
  }

  const answer = (s: IpaSound) => {
    if (picked || !question) return
    setPicked(s.id)
    setScore((sc) => ({
      right: sc.right + (s.id === question.sound.id ? 1 : 0),
      total: sc.total + 1,
    }))
  }

  const word = question ? exampleWord(question.example) : ''
  const correct = picked != null && picked === question?.sound.id

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {(['all', ...GROUPS] as const).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={group === g ? 'default' : 'outline'}
              onClick={() => chooseGroup(g)}
            >
              {g === 'all' ? 'Tất cả' : GROUP_LABEL[g]}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          Đúng{' '}
          <span className="font-semibold text-foreground">
            {score.right}/{score.total}
          </span>
        </span>
      </div>

      <div className="flex flex-col items-center gap-5 rounded-xl border bg-card p-6">
        {!question ? (
          <p className="py-8 text-sm text-muted-foreground">
            {ipa ? 'Không có câu hỏi cho nhóm này.' : 'Đang tải phiên âm…'}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Nghe từ này, nó có âm nào?
            </p>
            <div className="flex gap-2">
              <Button size="lg" onClick={() => speak(word, { accent })}>
                <Volume2 /> Nghe
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => speak(word, { accent, rate: 0.6 })}
              >
                <Snail /> Chậm
              </Button>
            </div>

            <div className="grid w-full grid-cols-2 gap-3">
              {question.options.map((s) => {
                const isAnswer = s.id === question.sound.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!!picked}
                    onClick={() => answer(s)}
                    className={cn(
                      'ipa rounded-lg border py-4 text-2xl font-medium transition-colors enabled:hover:border-primary/60 enabled:hover:bg-muted',
                      picked &&
                        isAnswer &&
                        'border-green-600 bg-green-600/10 text-green-700 dark:text-green-400',
                      picked === s.id &&
                        !isAnswer &&
                        'border-destructive bg-destructive/10 text-destructive',
                    )}
                  >
                    /{s.symbol[accent]}/
                  </button>
                )
              })}
            </div>

            {picked && (
              <div className="flex w-full flex-col items-center gap-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {correct ? (
                    <CheckCircle2 className="size-5 text-green-600" />
                  ) : (
                    <XCircle className="size-5 text-destructive" />
                  )}
                  {correct ? 'Chính xác!' : 'Chưa đúng'}
                </div>
                <div className="flex items-baseline gap-3 text-lg">
                  <MarkedWord example={question.example} />
                  <span className="ipa text-muted-foreground">
                    /{ipa?.get(word)}/
                  </span>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {question.sound.tip}
                </p>
                <Button onClick={() => next()}>
                  Câu tiếp <ChevronRight />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
