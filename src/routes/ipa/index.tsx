import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CheckCircle2,
  ChevronRight,
  Snail,
  Speech,
  Volume2,
  XCircle,
} from 'lucide-react'

import {
  AccentSwitch,
  MarkedWord,
  shuffle,
  useAccentSounds,
  useWordsIpa,
} from '#/components/ipa-shared'
import type { IpaMap } from '#/components/ipa-shared'
import { Button } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAccent } from '#/hooks/use-app-settings'
import { exampleWord, GROUP_LABEL, IPA_SOUNDS } from '#/lib/ipa-sounds'
import type { IpaSound, SoundGroup } from '#/lib/ipa-sounds'
import type { Accent } from '#/lib/speech'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/ipa/')({
  head: () => ({ meta: [{ title: 'Luyện IPA · Shadowing' }] }),
  component: IpaPage,
})

const GROUPS = Object.keys(GROUP_LABEL) as SoundGroup[]
const ALL_WORDS = [
  ...new Set(IPA_SOUNDS.flatMap((s) => s.examples.map(exampleWord))),
]

function IpaPage() {
  const [accent] = useAccent()
  const ipa = useWordsIpa('chart', ALL_WORDS)
  const sounds = useAccentSounds()

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Speech className="size-6 text-primary" />
            Luyện IPA
          </h1>
          <p className="text-sm text-muted-foreground">
            Bấm vào từng âm để xem cách đặt miệng, lỗi hay gặp, cặp âm dễ nhầm
            và tự ghi âm. Sang tab Luyện nghe để kiểm tra tai mình.
          </p>
        </div>
        <AccentSwitch />
      </header>

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Bảng âm</TabsTrigger>
          <TabsTrigger value="quiz">Luyện nghe</TabsTrigger>
        </TabsList>
        <TabsContent value="chart" className="mt-2">
          <SoundChart sounds={sounds} accent={accent} />
        </TabsContent>
        <TabsContent value="quiz" className="mt-2">
          <ListeningQuiz sounds={sounds} accent={accent} ipa={ipa} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SoundChart({
  sounds,
  accent,
}: {
  sounds: IpaSound[]
  accent: Accent
}) {
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <section key={group}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {GROUP_LABEL[group]}
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
            {sounds
              .filter((s) => s.group === group)
              .map((s) => (
                <Link
                  key={s.id}
                  to="/ipa/$soundId"
                  params={{ soundId: s.id }}
                  className="group flex flex-col items-center gap-1 rounded-lg border bg-card px-2 py-3 text-foreground no-underline transition-colors hover:border-primary/60 hover:bg-muted"
                >
                  <span className="ipa text-2xl font-medium group-hover:text-primary">
                    /{s.symbol[accent]}/
                  </span>
                  <MarkedWord
                    example={s.examples[0]}
                    className="text-xs font-normal text-muted-foreground"
                  />
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

interface Question {
  sound: IpaSound
  example: string
  options: IpaSound[]
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
