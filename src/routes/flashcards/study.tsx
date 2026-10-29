import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useHotkey } from '@tanstack/react-hotkeys'
import { ArrowLeft, ChevronDown, Clapperboard, Keyboard, Layers, Loader2, PartyPopper, RotateCcw, Volume2 } from 'lucide-react'
import { z } from 'zod'

import { CardImage } from '#/components/card-image'
import { AutoNextSwitch, useAutoNext } from '#/components/letter-typer'
import { TatoebaCredit, TypingCard } from '#/components/typing-card'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import { useAccent } from '#/hooks/use-app-settings'
import { studyQueueQuery } from '#/lib/queries'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { enrichCard } from '#/server/fns/essential'
import { reviewCard } from '#/server/fns/flashcards'
import type { CardInfo } from '#/db/schema'
import type { StudyCard } from '#/server/fns/flashcards'

const searchSchema = z.object({
  deck: z.number().int().optional().catch(undefined),
  /** học mọi unit của một sách từ vựng */
  book: z.string().optional().catch(undefined),
  /** type = nghe rồi gõ lại từ và câu ví dụ thay cho lật thẻ */
  mode: z.enum(['type']).optional().catch(undefined),
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

/** thẻ sách từ vựng chưa có nghĩa tiếng Việt, từ loại, cụm từ… → tra bổ sung (server lưu lại, chỉ tra một lần) */
const needsEnrich = (c: StudyCard | undefined): c is StudyCard =>
  !!c && c.info == null && !!c.ankiGuid?.startsWith('ee:')

const enrichQuery = (id: number) =>
  queryOptions({
    queryKey: ['enrich-card', id],
    queryFn: () => enrichCard({ data: { id } }),
    staleTime: Infinity,
    retry: false,
  })

const MORE_KEY = 'flashcards.showMore'

/** gộp collocation theo loại, mỗi loại vài từ ngắn (thẻ tra trước đây còn lưu dạng "a, b | c (informal)") */
function compactCollocations(list: CardInfo['collocations']) {
  const groups = new Map<string, string[]>()
  for (const c of list) {
    const words = c.words
      .split(/[|,]/)
      .map((w) => w.trim())
      .filter((w) => w && w.length <= 30 && !/[()=.·]/.test(w))
    groups.set(c.type, [...new Set([...(groups.get(c.type) ?? []), ...words])])
  }
  return [...groups]
    .filter(([, words]) => words.length > 0)
    .slice(0, 3)
    .map(([type, words]) => ({ type, words: words.slice(0, 5).join(', ') }))
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[7rem_1fr] gap-2">
      <span className="text-xs leading-5 text-muted-foreground">{label}</span>
      <span>{children}</span>
    </li>
  )
}

/**
 * ví dụ luôn hiện (tối đa 2); cụm từ, thành ngữ, họ từ, đồng nghĩa gọn lại trong mục "Mở rộng"
 * (nhớ trạng thái mở/đóng giữa các thẻ)
 */
function CardInfoSections({ info }: { info: CardInfo }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(MORE_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggle = () => {
    setOpen(!open)
    try {
      localStorage.setItem(MORE_KEY, open ? '0' : '1')
    } catch {}
  }

  const collocations = compactCollocations(info.collocations)
  const idioms = info.idioms.slice(0, 3)
  const family = info.family.slice(0, 4)
  const synonyms = info.synonyms.slice(0, 6)
  const hasMore = collocations.length + idioms.length + family.length + synonyms.length > 0

  return (
    <div className="flex flex-col gap-3 text-sm">
      {info.examples.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {info.examples.slice(0, 2).map((e) => (
            <li key={e.en}>
              <div>{e.en}</div>
              <div className="text-muted-foreground">
                {e.vi}
                {e.src && <TatoebaCredit href={e.src} />}
              </div>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={toggle}
            aria-expanded={open}
          >
            <ChevronDown className={cn('size-3.5 transition-transform', !open && '-rotate-90')} />
            Mở rộng: cụm từ, thành ngữ, họ từ
          </button>
          {open && (
            <ul className="flex flex-col gap-1.5">
              {collocations.map((c) => (
                <Row key={c.type} label={c.type || 'cụm từ'}>
                  <span className="font-medium">{c.words}</span>
                </Row>
              ))}
              {idioms.map((i) => (
                <Row key={i.en} label="thành ngữ">
                  <span className="font-medium">{i.en}</span>
                  <span className="text-muted-foreground"> — {i.vi}</span>
                </Row>
              ))}
              {family.map((f) => (
                <Row key={f.kind} label={f.kind}>
                  {f.words.join(', ')}
                </Row>
              ))}
              {synonyms.length > 0 && <Row label="đồng nghĩa">{synonyms.join(', ')}</Row>}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Study() {
  const { deck, book, mode } = Route.useSearch()
  const typing = mode === 'type'
  const [autoNext, setAutoNext] = useAutoNext()
  const queryClient = useQueryClient()
  const [accent] = useAccent()
  const { data, isLoading, error } = useQuery(studyQueueQuery(deck, book))
  const [queue, setQueue] = useState<StudyCard[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const total = useRef(0)
  // thẻ mới học trong phiên: học xong thì ôn lại một lượt (không ghi lịch FSRS)
  const learned = useRef(new Map<number, StudyCard>())
  const [drill, setDrill] = useState(false)
  // mỗi lượt chấm một thẻ mới (kể cả thẻ cũ quay lại) → chế độ gõ bắt đầu lại từ đầu
  const [turn, setTurn] = useState(0)

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

  const current = queue?.[0]
  const enriched = useQuery({ ...enrichQuery(current?.id ?? 0), enabled: needsEnrich(current) })
  const card =
    current && enriched.data?.id === current.id
      ? {
          ...current,
          meaningVi: enriched.data.meaningVi,
          ipa: enriched.data.ipa,
          example: enriched.data.example,
          imageUrl: enriched.data.imageUrl,
          info: enriched.data.info,
        }
      : current

  // thẻ sách không có ảnh riêng (English Vocabulary in Use, Verbal Advantage) → ảnh Bing theo từ;
  // chờ tra xong vì lúc tra có thể được gắn ảnh của sách
  const image =
    card?.imageUrl ??
    (card?.ankiGuid?.startsWith('ee:') && !enriched.isFetching
      ? `/api/bing-image/${encodeURIComponent(card.front)}`
      : null)

  // tra trước thẻ kế tiếp để lật thẻ không phải chờ
  const next = queue?.[1]
  useEffect(() => {
    if (needsEnrich(next)) void queryClient.prefetchQuery(enrichQuery(next.id))
  }, [next, queryClient])

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
    const src = c.audioUrl ?? (c.audioFile ? `/api/card-media/${encodeURIComponent(c.audioFile)}` : null)
    if (src) {
      audio = new Audio(src)
      audio.play().catch(() => speak(c.front, { accent }))
    } else speak(c.front, { accent })
  }

  const rate = (rating: Rating) => {
    if (!card || (!revealed && !typing)) return
    setRevealed(false)
    setTurn((n) => n + 1)
    if (drill) {
      // ôn lại: chưa nhớ thì đưa xuống cuối, nhớ rồi thì bỏ khỏi lượt ôn
      const again = rating <= 2
      setQueue((q) => {
        if (!q?.length) return []
        const [first, ...rest] = q
        return again ? [...rest, first] : rest
      })
      if (!again) setDone((n) => n + 1)
      return
    }
    if (card.state === 0) learned.current.set(card.id, card)
    // chuyển thẻ ngay, lưu ở nền
    review.mutate({ cardId: card.id, rating })
    setQueue((q) => q?.slice(1) ?? null)
    setDone((n) => n + 1)
  }

  const startDrill = () => {
    const list = [...learned.current.values()]
    learned.current = new Map()
    total.current = list.length
    setDrill(true)
    setDone(0)
    setQueue(list)
  }

  const reveal = () => {
    if (!card || revealed) return
    setRevealed(true)
    play(card)
  }

  useHotkey('Space', () => (revealed ? rate(3) : reveal()), { ignoreInputs: true, enabled: !typing })
  useHotkey('Enter', () => (revealed ? rate(3) : reveal()), { ignoreInputs: true, enabled: !typing })
  useHotkey('1', () => rate(1), { ignoreInputs: true, enabled: !typing })
  useHotkey('2', () => rate(2), { ignoreInputs: true, enabled: !typing })
  useHotkey('3', () => rate(3), { ignoreInputs: true, enabled: !typing })
  useHotkey('4', () => rate(4), { ignoreInputs: true, enabled: !typing })
  useHotkey('R', () => card && play(card), { ignoreInputs: true, enabled: !typing })
  const navigate = Route.useNavigate()
  useHotkey('Mod+E', () =>
    void navigate({ search: (s) => ({ ...s, mode: typing ? undefined : ('type' as const) }), replace: true }),
  )

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
        {typing && <AutoNextSwitch on={autoNext} onChange={setAutoNext} />}
        <Button size="sm" variant="outline" asChild>
          <Link
            to="."
            search={(s) => ({ ...s, mode: typing ? undefined : ('type' as const) })}
            title="Đổi chế độ (Ctrl/⌘+E)"
          >
            {typing ? <Layers /> : <Keyboard />}
            {typing ? 'Lật thẻ' : 'Gõ từ'}
          </Link>
        </Button>
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
          {drill ? (
            <p className="text-lg font-medium">Đã ôn lại xong {done} từ!</p>
          ) : (
            <>
              <p className="text-lg font-medium">Đã học xong hôm nay!</p>
              <p className="text-sm text-muted-foreground">
                {done ? `Bạn vừa ôn ${done} lượt thẻ.` : 'Không có thẻ nào đến hạn.'} Quay lại sau để ôn tiếp.
              </p>
            </>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {!drill && learned.current.size > 0 && (
              <Button onClick={startDrill}>
                <RotateCcw />
                Ôn lại {learned.current.size} từ vừa học
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/flashcards">Về danh sách thẻ</Link>
            </Button>
          </div>
        </div>
      ) : typing ? (
        <>
          <TypingCard
            key={turn}
            card={card}
            image={image}
            accent={accent}
            enriching={enriched.isFetching}
            play={play}
            autoNext={autoNext}
            onDone={rate}
          />
          {review.error && <p className="text-sm text-destructive">{review.error.message}</p>}
          <p className="text-center text-xs text-muted-foreground">
            Gõ từ: Space nghe lại · Tab gợi ý chữ · Esc xem đáp án — Gõ câu: Enter kiểm tra · Tab gợi ý · Esc bỏ qua · Ctrl/⌘+J nghe lại (+Shift: chậm) · Ctrl/⌘+E đổi chế độ
          </p>
        </>
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
                {image && <CardImage key={`${card.id}|${image}`} src={image} alt={card.front} />}
                {(card.ipa || card.info?.pos) && (
                  <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    {card.ipa && <span className="ipa">{card.ipa}</span>}
                    {card.info?.pos && <Badge variant="secondary">{card.info.pos}</Badge>}
                  </p>
                )}
                {card.meaningVi && <p className="text-xl font-medium whitespace-pre-line">{card.meaningVi}</p>}
                <p
                  className={cn(
                    'whitespace-pre-line',
                    card.meaningVi ? 'text-muted-foreground' : 'text-xl font-medium',
                  )}
                >
                  {card.back}
                </p>
                {enriched.isFetching && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Đang tra nghĩa tiếng Việt…
                  </p>
                )}
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
                {card.info && <CardInfoSections info={card.info} />}
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

          {revealed && drill ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="border-bad/40 text-bad hover:bg-bad-soft" onClick={() => rate(1)}>
                Chưa nhớ <kbd className="ml-1 text-xs opacity-70">1</kbd>
              </Button>
              <Button variant="outline" className="border-ok/40 text-ok hover:bg-ok-soft" onClick={() => rate(3)}>
                Đã nhớ <kbd className="ml-1 text-xs opacity-70">Space</kbd>
              </Button>
            </div>
          ) : revealed ? (
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
            {drill
              ? 'Ôn lại từ vừa học, không đổi lịch ôn · Space hiện đáp án / đã nhớ · 1 chưa nhớ · R nghe lại'
              : 'Phím tắt: Space hiện đáp án · 1 Quên · 2 Khó · 3 Nhớ · 4 Dễ · R nghe lại · Ctrl/⌘+E chế độ gõ'}
          </p>
        </>
      )}
    </div>
  )
}
