import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useHotkey } from '@tanstack/react-hotkeys'
import { ArrowLeft, Clapperboard, Loader2, PartyPopper, Volume2 } from 'lucide-react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import { useAccent } from '#/hooks/use-app-settings'
import { studyQueueQuery } from '#/lib/queries'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { reviewCard } from '#/server/fns/flashcards'
import type { StudyCard } from '#/server/fns/flashcards'

const searchSchema = z.object({
  deck: z.number().int().optional().catch(undefined),
})

export const Route = createFileRoute('/flashcards/study')({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Học thẻ · Shadowing' }] }),
  component: Study,
})

/** thẻ chấm Again/Hard còn hạn trong khoảng này thì học lại ngay trong phiên (như Anki) */
const LEARN_AHEAD_MS = 20 * 60_000

const RATINGS = [
  { rating: 1, label: 'Quên', className: 'border-bad/40 text-bad hover:bg-bad-soft' },
  { rating: 2, label: 'Khó', className: 'border-miss/40 text-miss hover:bg-miss-soft' },
  { rating: 3, label: 'Nhớ', className: 'border-ok/40 text-ok hover:bg-ok-soft' },
  { rating: 4, label: 'Dễ', className: 'border-primary/40 text-primary hover:bg-primary/10' },
] as const

type Rating = (typeof RATINGS)[number]['rating']

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** che từ đang học trong câu ngữ cảnh ở mặt trước */
const maskSentence = (sentence: string, word: string) =>
  sentence.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi'), '_____')

let audio: HTMLAudioElement | null = null

function Study() {
  const { deck } = Route.useSearch()
  const queryClient = useQueryClient()
  const [accent] = useAccent()
  const { data, isLoading, error } = useQuery(studyQueueQuery(deck))
  const [queue, setQueue] = useState<StudyCard[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const total = useRef(0)

  useEffect(() => {
    if (data && queue === null) {
      setQueue(data)
      total.current = data.length
    }
  }, [data, queue])

  // rời trang → số thẻ của các bộ đã đổi
  useEffect(
    () => () => void queryClient.invalidateQueries({ queryKey: ['decks'] }),
    [queryClient],
  )

  const card = queue?.[0]

  const review = useMutation({
    mutationFn: (v: { cardId: number; rating: Rating }) => reviewCard({ data: v }),
    onSuccess: (updated) => {
      if (new Date(updated.due).getTime() - Date.now() < LEARN_AHEAD_MS) {
        total.current++
        setQueue((q) => [...(q ?? []), updated])
      }
    },
  })

  const play = (c: StudyCard) => {
    audio?.pause()
    if (c.audioFile) {
      audio = new Audio(`/api/card-media/${encodeURIComponent(c.audioFile)}`)
      audio.play().catch(() => speak(c.front, { accent }))
    } else speak(c.front, { accent })
  }

  const rate = (rating: Rating) => {
    if (!card || !revealed) return
    // chuyển thẻ ngay, lưu ở nền
    review.mutate({ cardId: card.id, rating })
    setQueue((q) => q?.slice(1) ?? null)
    setRevealed(false)
    setDone((n) => n + 1)
  }

  const reveal = () => {
    if (!card || revealed) return
    setRevealed(true)
    play(card)
  }

  useHotkey('Space', () => (revealed ? rate(3) : reveal()), { ignoreInputs: true })
  useHotkey('Enter', () => (revealed ? rate(3) : reveal()), { ignoreInputs: true })
  useHotkey('1', () => rate(1), { ignoreInputs: true })
  useHotkey('2', () => rate(2), { ignoreInputs: true })
  useHotkey('3', () => rate(3), { ignoreInputs: true })
  useHotkey('4', () => rate(4), { ignoreInputs: true })
  useHotkey('R', () => card && play(card), { ignoreInputs: true })

  const masked = useMemo(
    () => (card?.sentence ? maskSentence(card.sentence, card.front) : null),
    [card],
  )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center gap-3">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/flashcards" aria-label="Quay lại">
            <ArrowLeft />
          </Link>
        </Button>
        <Progress
          value={total.current ? (done / total.current) * 100 : 0}
          className="flex-1"
        />
        <span className="font-mono text-xs text-muted-foreground">
          {done}/{total.current}
        </span>
      </header>

      {isLoading || (data && queue === null) ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-destructive">{error.message}</p>
      ) : !card ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <PartyPopper className="size-8 text-primary" />
          <p className="text-lg font-medium">Đã học xong hôm nay!</p>
          <p className="text-sm text-muted-foreground">
            {done ? `Bạn vừa ôn ${done} lượt thẻ.` : 'Không có thẻ nào đến hạn.'} Quay lại sau để ôn tiếp.
          </p>
          <Button asChild variant="outline">
            <Link to="/flashcards">Về danh sách thẻ</Link>
          </Button>
        </div>
      ) : (
        <>
          <article className="flex min-h-80 flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-2">
              <h2 className="flex-1 text-3xl font-semibold whitespace-pre-line">{card.front}</h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => play(card)}
                title="Nghe (R)"
              >
                <Volume2 />
              </Button>
            </div>
            {masked && !revealed && (
              <p className="text-lg text-muted-foreground">{masked}</p>
            )}

            {revealed && (
              <div className="flex flex-col gap-3 border-t pt-4">
                {card.ipa && <p className="ipa text-muted-foreground">{card.ipa}</p>}
                <p className="text-xl font-medium whitespace-pre-line">{card.back}</p>
                {card.sentence && (
                  <button
                    type="button"
                    className="text-left text-lg hover:text-primary"
                    title="Nghe câu"
                    onClick={() => speak(card.sentence!, { accent })}
                  >
                    “{card.sentence}”
                  </button>
                )}
                {card.example && (
                  <p className="rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-line">
                    {card.example}
                  </p>
                )}
                {card.extra && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{card.extra}</p>
                )}
                {card.youtubeId && card.segmentIdx != null && (
                  <Button size="sm" variant="outline" className="self-start" asChild>
                    <Link
                      to="/videos/$videoId/shadow"
                      params={{ videoId: card.youtubeId }}
                      search={{ seg: card.segmentIdx }}
                    >
                      <Clapperboard />
                      Mở câu trong video
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </article>

          {revealed ? (
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <Button
                  key={r.rating}
                  variant="outline"
                  className={cn('flex h-auto flex-col gap-0.5 py-2', r.className)}
                  onClick={() => rate(r.rating)}
                >
                  <span className="font-semibold">{r.label}</span>
                  <span className="text-xs opacity-80">{card.intervals[r.rating]}</span>
                </Button>
              ))}
            </div>
          ) : (
            <Button size="lg" onClick={reveal}>
              Hiện đáp án <kbd className="ml-2 text-xs opacity-70">Space</kbd>
            </Button>
          )}
          {review.error && <p className="text-sm text-destructive">{review.error.message}</p>}
          <p className="text-center text-xs text-muted-foreground">
            Phím tắt: Space hiện đáp án · 1 Quên · 2 Khó · 3 Nhớ · 4 Dễ · R nghe lại
          </p>
        </>
      )}
    </div>
  )
}
