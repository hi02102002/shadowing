import { useEffect, useRef, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { ChevronRight, Eye, Lightbulb, Loader2, Snail, Volume2 } from 'lucide-react'

import { CardImage } from '#/components/card-image'
import { LetterSlots, useAutoAdvance, useLetterTyper } from '#/components/letter-typer'
import { DiffView } from '#/components/diff-view'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { alignWords, firstLetterHint } from '#/lib/align'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import type { AlignResult } from '#/lib/align'
import type { Accent } from '#/lib/speech'
import type { StudyCard } from '#/server/fns/flashcards'

/** từ cần gõ: dòng đầu mặt trước, bỏ ghi chú trong ngoặc, vd. "bank (n)" → "bank" */
export const typingTarget = (front: string) =>
  front.split('\n')[0].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** che từ đang học trong định nghĩa tiếng Anh (định nghĩa sách hay nhắc lại chính từ đó) */
const maskWord = (text: string, word: string) =>
  word ? text.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi'), '_____') : text

/** câu dài hơn thì gõ lại mệt, bỏ */
const MAX_SENTENCE_WORDS = 12

const wordCount = (s: string) => s.split(/\s+/).length

/**
 * câu hoàn chỉnh và ngắn: viết hoa đầu câu, có dấu kết câu, 4–12 từ, không có "/" kiểu "plans / candidates"
 * (ví dụ từ điển hay chỉ là cụm từ như "to husband one's strength")
 */
const isShortSentence = (s: string) =>
  /^["“‘']?[A-Z0-9]/.test(s) &&
  /[.!?]["”’']?$/.test(s) &&
  wordCount(s) >= 4 &&
  wordCount(s) <= MAX_SENTENCE_WORDS &&
  !s.includes('/')

/**
 * câu ví dụ để nghe-gõ từ câu trong video, ví dụ tra thêm (có nghĩa tiếng Việt) và ví dụ của sách:
 * chỉ lấy câu hoàn chỉnh ngắn, ưu tiên câu có chứa từ đang học rồi tới câu ngắn nhất; không có thì bỏ bước gõ câu
 */
type Sentence = { en: string; vi: string | null; src?: string }

function pickSentence(card: StudyCard, word: string): Sentence | null {
  const lower = word.toLowerCase()
  const candidates = [
    card.sentence && { en: card.sentence.trim(), vi: null },
    ...(card.info?.examples.map((e) => ({ ...e, en: e.en.trim() })) ?? []),
    card.example && { en: card.example.split('\n')[0].trim(), vi: null },
  ]
    .filter((c): c is Sentence => !!c && isShortSentence(c.en))
    .sort(
      (a, b) =>
        Number(!a.en.toLowerCase().includes(lower)) - Number(!b.en.toLowerCase().includes(lower)) ||
        wordCount(a.en) - wordCount(b.en),
    )
  return candidates.at(0) ?? null
}

/** ghi nguồn câu Tatoeba (CC BY 2.0 FR) */
export function TatoebaCredit({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="ml-1.5 text-xs text-muted-foreground/70 underline-offset-2 hover:underline"
      title="Câu từ Tatoeba, giấy phép CC BY 2.0 FR"
    >
      · Tatoeba
    </a>
  )
}

const RATING_LABEL = { 1: 'Quên', 2: 'Khó', 3: 'Nhớ' } as const
type TypedRating = keyof typeof RATING_LABEL

interface Props {
  card: StudyCard
  image: string | null
  accent: Accent
  /** đang tra nghĩa tiếng Việt / ví dụ cho thẻ sách từ vựng */
  enriching: boolean
  play: (card: StudyCard) => void
  /** gõ xong (và kiểm tra câu) thì tự sang thẻ tiếp */
  autoNext: boolean
  /** gõ xong từ (và câu): sai/gợi ý → Khó, xem đáp án → Quên, gõ đúng hết → Nhớ */
  onDone: (rating: TypedRating) => void
}

/**
 * Chế độ gõ từ: nhìn ảnh + nghĩa, nghe phát âm, gõ từng chữ cái của từ (sai thì báo đỏ, không đi tiếp);
 * gõ xong thì nghe câu ví dụ và gõ lại cả câu (chỉ để luyện, không ảnh hưởng điểm thẻ).
 * Thẻ đổi thì parent đổi `key` để reset trạng thái.
 */
export function TypingCard({ card, image, accent, enriching, play, autoNext, onDone }: Props) {
  const target = typingTarget(card.front)
  const typer = useLetterTyper(target, {
    onReplay: () => play(card),
    onComplete: () => {
      play(card)
      setPhase('pending')
    },
  })
  const { mistakes, hints, gaveUp } = typer
  const [phase, setPhase] = useState<'word' | 'pending' | 'sentence' | 'done'>('word')
  const [sentence, setSentence] = useState<ReturnType<typeof pickSentence>>(null)
  const [typed, setTyped] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [result, setResult] = useState<AlignResult | null>(null)
  const sentenceInput = useRef<HTMLInputElement>(null)

  const rating: TypedRating = gaveUp ? 1 : mistakes + hints === 0 ? 3 : 2

  useEffect(() => {
    play(card)
    // chỉ đọc khi vào thẻ
  }, [])

  useEffect(() => {
    if (phase === 'sentence') sentenceInput.current?.focus()
    if (phase === 'done') typer.inputRef.current?.focus()
  }, [phase])

  // gõ xong từ → chờ tra nghĩa xong (câu ví dụ hoàn chỉnh thường đến từ AI) rồi mới chọn câu
  useEffect(() => {
    if (phase !== 'pending' || enriching) return
    const s = pickSentence(card, target)
    setSentence(s)
    setPhase(s ? 'sentence' : 'done')
  }, [phase, enriching, card, target])

  // đọc câu sau khi phát âm từ xong
  useEffect(() => {
    if (phase !== 'sentence' || !sentence) return
    const t = setTimeout(() => speak(sentence.en, { accent }), 900)
    return () => clearTimeout(t)
  }, [phase, sentence, accent])

  const check = () => {
    if (!sentence || !typed.trim()) return
    setResult(alignWords(sentence.en, typed))
  }

  const next = () => onDone(rating)

  useHotkey('Enter', next, { enabled: phase === 'done' || !!result, ignoreInputs: true })
  // không có câu ví dụ: nghe xong từ là sang; có câu: chờ lâu hơn để xem từ nào sai
  useAutoAdvance(phase === 'done' || !!result, autoNext, next, result ? 3000 : 1800)
  // Ctrl/⌘ + phím chạy được cả khi đang gõ trong ô nhập
  useHotkey('Mod+J', () => (phase === 'sentence' && sentence ? speak(sentence.en, { accent }) : play(card)))
  useHotkey('Mod+Shift+J', () => sentence && speak(sentence.en, { accent, rate: 0.7 }), {
    enabled: phase === 'sentence',
  })

  return (
    <article
      className="flex min-h-80 flex-col items-center gap-5 rounded-2xl border bg-card p-6 shadow-sm"
      onClick={() => phase === 'word' && typer.inputRef.current?.focus()}
    >
      {image && <CardImage key={`${card.id}|${image}`} src={image} alt="" className="max-h-44" />}

      <div className="flex max-w-full flex-col items-center gap-1 text-center">
        {card.meaningVi && <p className="text-xl font-medium whitespace-pre-line">{card.meaningVi}</p>}
        <p
          className={cn(
            'line-clamp-3 whitespace-pre-line',
            card.meaningVi ? 'text-sm text-muted-foreground' : 'text-lg font-medium',
          )}
        >
          {maskWord(card.back, target)}
        </p>
        {enriching && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Đang tra nghĩa tiếng Việt…
          </p>
        )}
      </div>

      <LetterSlots typer={typer} onEnter={() => phase === 'done' && next()} />

      {phase === 'word' ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => play(card)} title="Nghe lại (Space hoặc Ctrl/⌘+J)">
            <Volume2 /> Nghe
          </Button>
          <Button size="sm" variant="ghost" onClick={typer.hint} title="Hiện chữ kế tiếp (Tab)">
            <Lightbulb /> Gợi ý
          </Button>
          {!gaveUp && (
            <Button size="sm" variant="ghost" onClick={typer.giveUp} title="Xem đáp án (Esc)">
              <Eye /> Xem đáp án
            </Button>
          )}
        </div>
      ) : (
        <p className="flex flex-wrap items-center justify-center gap-2 text-muted-foreground">
          {card.ipa && <span className="ipa">{card.ipa}</span>}
          {card.info?.pos && <Badge variant="secondary">{card.info.pos}</Badge>}
          <Badge
            variant="outline"
            className={cn(rating === 1 ? 'text-bad' : rating === 2 ? 'text-miss' : 'text-ok')}
            title={`${mistakes} lần sai · ${hints} gợi ý`}
          >
            {RATING_LABEL[rating]} · {card.intervals[rating]}
          </Badge>
        </p>
      )}

      {phase === 'sentence' && sentence && (
        <div className="flex w-full flex-col gap-2 border-t pt-4">
          {result ? (
            <DiffView tokens={result.tokens} />
          ) : (
            <Input
              ref={sentenceInput}
              className="h-11 text-lg md:text-lg"
              placeholder="Gõ lại câu vừa nghe…"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  check()
                } else if (e.key === 'Tab') {
                  e.preventDefault()
                  setShowHint(true)
                } else if (e.key === 'Escape') next()
              }}
            />
          )}
          {showHint && !result && (
            <p className="font-mono text-sm tracking-wide text-muted-foreground">{firstLetterHint(sentence.en)}</p>
          )}
          {sentence.vi && (
            <p className="text-sm text-muted-foreground">
              {sentence.vi}
              {sentence.src && <TatoebaCredit href={sentence.src} />}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => speak(sentence.en, { accent })} title="Nghe câu (Ctrl/⌘+J)">
              <Volume2 /> Nghe câu
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => speak(sentence.en, { accent, rate: 0.7 })}
              title="Nghe chậm (Ctrl/⌘+Shift+J)"
            >
              <Snail /> Chậm
            </Button>
            {!result && !showHint && (
              <Button size="sm" variant="ghost" onClick={() => setShowHint(true)} title="Chữ cái đầu mỗi từ (Tab)">
                <Lightbulb /> Gợi ý
              </Button>
            )}
            {result && <span className="font-mono text-sm text-muted-foreground">{result.score}%</span>}
            <span className="flex-1" />
            {!result && (
              <Button size="sm" variant="ghost" onClick={next} title="Esc">
                Bỏ qua câu
              </Button>
            )}
            {result ? (
              <Button size="sm" onClick={next}>
                Tiếp <ChevronRight />
              </Button>
            ) : (
              <Button size="sm" onClick={check} disabled={!typed.trim()}>
                Kiểm tra <kbd className="ml-1 text-xs opacity-70">Enter</kbd>
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <Button className="self-stretch" onClick={next}>
          Tiếp <kbd className="ml-1 text-xs opacity-70">Enter</kbd>
        </Button>
      )}
    </article>
  )
}
