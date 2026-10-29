import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { createStore } from '@tanstack/react-store'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  BookmarkCheck,
  BookmarkPlus,
  ChevronRight,
  Eye,
  GraduationCap,
  Lightbulb,
  Loader2,
  PartyPopper,
  Volume2,
  X,
} from 'lucide-react'

import { AutoNextSwitch, LetterSlots, useAutoAdvance, useAutoNext, useLetterTyper } from '#/components/letter-typer'
import type { TypingStats } from '#/components/letter-typer'
import { SaveToDeck } from '#/components/save-to-deck'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import { playerActions } from '#/lib/player-store'
import { cn } from '#/lib/utils'
import { dictionaryEntry } from '#/server/fns/dictionary'
import { saveVideoWords } from '#/server/fns/flashcards'
import type { VocabLevel } from '#/lib/levels'
import type { SegmentView } from '#/server/fns/videos'

/** đang luyện gõ từ của video → layout ẩn phụ đề trên video và chữ trong transcript để khỏi lộ đáp án */
export const vocabPracticeStore = createStore(false)

export interface VocabItem {
  key: string
  /** dạng gốc / dạng từ điển của cụm: thứ được lưu vào thẻ */
  text: string
  /** dạng xuất hiện trong câu: thứ phải gõ */
  surface: string
  segIdx: number
  level: VocabLevel
  /** loại cụm từ (phrasal verb, idiom…), không có với từ đơn */
  kind?: string
  /** từ loại của từ đơn bằng tiếng Việt, vd. "động từ" */
  pos?: string
  meaningVi?: string
  count?: number
  saved: boolean
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** tách câu quanh lần xuất hiện đầu của surface: [trước, khớp, sau]; không thấy thì null */
export function splitAround(sentence: string, surface: string): [string, string, string] | null {
  const m = new RegExp(`(?<![\\p{L}'’])${escapeRegExp(surface)}(?![\\p{L}])`, 'iu').exec(sentence)
  if (!m) return null
  return [sentence.slice(0, m.index), m[0], sentence.slice(m.index + m[0].length)]
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}'’]/gu, '')

/** khoảng thời gian của từ/cụm trong câu theo timing từng từ; không khớp thì cả câu */
export function clipFor(seg: SegmentView, surface: string) {
  const want = surface.split(/\s+/).map(norm).filter(Boolean)
  const words = seg.words.map((w) => norm(w.w))
  for (let i = 0; i + want.length <= words.length; i++) {
    if (want.every((w, j) => words[i + j] === w))
      return { startMs: seg.words[i].s, endMs: seg.words[i + want.length - 1].e }
  }
  return { startMs: seg.startMs, endMs: seg.endMs }
}

/** nghĩa ngắn từ từ điển Anh–Việt (dunno.ai, có cache) cho từ đơn; cụm từ đã có nghĩa do AI */
function useMeaning(item: VocabItem) {
  const dict = useQuery({
    queryKey: ['dict', item.text.toLowerCase()],
    queryFn: () => dictionaryEntry({ data: { text: item.text } }),
    enabled: !item.meaningVi,
    staleTime: Infinity,
    retry: false,
  })
  return (
    item.meaningVi ??
    dict.data?.senses
      .slice(0, 2)
      .map((s) => s.means.slice(0, 2).join('; '))
      .join(' · ')
  )
}

function PracticeItem({
  item,
  seg,
  autoNext,
  onNext,
}: {
  item: VocabItem
  seg: SegmentView
  autoNext: boolean
  onNext: (stats: TypingStats) => void
}) {
  const meaning = useMeaning(item)
  const [stats, setStats] = useState<TypingStats | null>(null)
  const replay = () => playerActions.playRange(seg.startMs, seg.endMs)
  const clip = clipFor(seg, item.surface)
  const typer = useLetterTyper(item.surface, {
    onReplay: replay,
    onComplete: (s) => {
      setStats(s)
      playerActions.playClip(clip.startMs, clip.endMs)
    },
  })
  const parts = splitAround(seg.text, item.surface)

  useEffect(() => {
    replay()
    // chỉ phát khi vào từ mới
  }, [])

  const next = () => stats && onNext(stats)
  useHotkey('Mod+J', replay)
  useHotkey('Enter', next, { enabled: !!stats, ignoreInputs: true })
  // đợi nghe xong từ (clip ngắn) rồi sang từ tiếp
  useAutoAdvance(!!stats, autoNext, next, 1800)

  return (
    <article className="flex flex-col items-center gap-5 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="flex items-center gap-2">
          <Badge variant="secondary">{item.level}</Badge>
          {(item.kind ?? item.pos) && <Badge variant="outline">{item.kind ?? item.pos}</Badge>}
        </span>
        {meaning && <p className="text-lg font-medium">{meaning}</p>}
      </div>

      {parts && (
        <p className="text-center text-lg leading-relaxed text-muted-foreground">
          {parts[0]}
          <span
            className={cn(
              'rounded px-1 font-medium',
              stats ? 'bg-ok-soft text-ok' : 'bg-muted tracking-widest text-muted-foreground',
            )}
          >
            {stats ? parts[1] : parts[1].replace(/[\p{L}\p{N}]/gu, '_')}
          </span>
          {parts[2]}
        </p>
      )}

      <LetterSlots typer={typer} onEnter={next} />

      {stats ? (
        <div className="flex w-full flex-col items-center gap-3 border-t pt-4">
          {item.text.toLowerCase() !== item.surface.toLowerCase() && (
            <p className="text-muted-foreground">
              Dạng gốc: <b className="text-foreground">{item.text}</b>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => playerActions.playClip(clip.startMs, clip.endMs)}>
              <Volume2 /> Nghe từ
            </Button>
            <SaveToDeck
              text={item.text}
              sentence={seg.text}
              segmentId={seg.id}
              startMs={clip.startMs}
              endMs={clip.endMs}
            />
            <Button size="sm" onClick={next}>
              Tiếp <ChevronRight />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="ghost" onClick={replay} title="Nghe lại câu (Space hoặc Ctrl/⌘+J)">
            <Volume2 /> Nghe câu
          </Button>
          <Button size="sm" variant="ghost" onClick={typer.hint} title="Hiện chữ kế tiếp (Tab)">
            <Lightbulb /> Gợi ý
          </Button>
          {!typer.gaveUp && (
            <Button size="sm" variant="ghost" onClick={typer.giveUp} title="Xem đáp án (Esc)">
              <Eye /> Xem đáp án
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

interface Result {
  item: VocabItem
  seg: SegmentView
  stats: TypingStats
}

const missed = (s: TypingStats) => s.gaveUp || s.mistakes + s.hints > 0

/** cuối buổi: lưu từ gõ sai (hoặc tất cả) vào bộ thẻ riêng của video để ôn theo lịch FSRS */
function Summary({ youtubeId, results, onExit }: { youtubeId: string; results: Result[]; onExit: () => void }) {
  const queryClient = useQueryClient()
  const wrong = results.filter((r) => missed(r.stats))
  const save = useMutation({
    mutationFn: (list: Result[]) =>
      saveVideoWords({
        data: {
          youtubeId,
          items: list.map(({ item, seg }) => {
            const clip = clipFor(seg, item.surface)
            return {
              text: item.text,
              sentence: seg.text,
              segmentId: seg.id,
              startMs: Math.round(clip.startMs),
              endMs: Math.round(clip.endMs),
              meaningVi: item.meaningVi,
            }
          }),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video-vocab', youtubeId] })
      void queryClient.invalidateQueries({ queryKey: ['video-phrases', youtubeId] })
      void queryClient.invalidateQueries({ queryKey: ['decks'] })
      void queryClient.invalidateQueries({ queryKey: ['card-saved'] })
    },
  })

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
      <PartyPopper className="size-8 text-primary" />
      <p className="text-lg font-medium">Đã luyện {results.length} từ!</p>
      <p className="text-sm text-muted-foreground">
        {results.length - wrong.length} từ gõ đúng ngay
        {wrong.length > 0 && <>, {wrong.length} từ sai hoặc cần gợi ý</>}.
      </p>
      {wrong.length > 0 && (
        <p className="max-w-md text-sm">
          {wrong.map((r) => r.item.text).join(', ')}
        </p>
      )}
      {save.data ? (
        <div className="flex flex-col items-center gap-2">
          <p className="flex items-center gap-1.5 text-sm text-ok">
            <BookmarkCheck className="size-4" />
            Đã lưu {save.data.total} từ vào bộ “{save.data.deckName}”
            {save.data.created < save.data.total && ` (${save.data.total - save.data.created} từ đã có, cập nhật lại)`}
          </p>
          <Button asChild>
            <Link to="/flashcards/study" search={{ deck: save.data.deckId, mode: 'type' }}>
              <GraduationCap />
              Ôn ngay bằng chế độ gõ
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && (
            <Button onClick={() => save.mutate(wrong)} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <BookmarkPlus />}
              Lưu {wrong.length} từ gõ sai
            </Button>
          )}
          <Button variant="outline" onClick={() => save.mutate(results)} disabled={save.isPending}>
            Lưu tất cả {results.length} từ
          </Button>
        </div>
      )}
      {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
      <Button variant="ghost" onClick={onExit}>
        Về danh sách từ
      </Button>
    </div>
  )
}

/**
 * Luyện gõ từ mới của video: phát đúng câu trong video, che từ trong câu, gõ từng chữ cái;
 * gõ xong nghe riêng từ đó và lưu thẻ kèm câu + clip. Cuối buổi (hoặc bấm thoát giữa chừng) lưu cả loạt.
 */
export function VocabPractice({
  youtubeId,
  items,
  segments,
  onExit,
}: {
  youtubeId: string
  items: VocabItem[]
  segments: SegmentView[]
  onExit: () => void
}) {
  const [i, setI] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  // thoát giữa chừng mà đã gõ vài từ → xem tổng kết để lưu trước khi rời
  const [ended, setEnded] = useState(false)
  const [autoNext, setAutoNext] = useAutoNext()
  const byIdx = new Map(segments.map((s) => [s.idx, s]))

  useEffect(() => {
    vocabPracticeStore.setState(() => true)
    return () => vocabPracticeStore.setState(() => false)
  }, [])

  const item = ended ? undefined : items.at(i)
  const seg = item && byIdx.get(item.segIdx)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => (seg && results.length ? setEnded(true) : onExit())}
          aria-label="Thoát luyện gõ"
        >
          <X />
        </Button>
        <Progress value={(i / items.length) * 100} className="flex-1" />
        <span className="font-mono text-xs text-muted-foreground">
          {i}/{items.length}
        </span>
        <AutoNextSwitch on={autoNext} onChange={setAutoNext} />
      </header>

      {item && seg ? (
        <PracticeItem
          key={item.key}
          item={item}
          seg={seg}
          autoNext={autoNext}
          onNext={(stats) => {
            setResults((r) => [...r, { item, seg, stats }])
            setI(i + 1)
          }}
        />
      ) : results.length ? (
        <Summary youtubeId={youtubeId} results={results} onExit={onExit} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">Chưa luyện từ nào.</p>
          <Button variant="outline" onClick={onExit}>
            Về danh sách từ
          </Button>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Nghe câu trong video rồi gõ từ bị che · Space / Ctrl/⌘+J nghe lại · Tab gợi ý chữ · Esc xem đáp án · Enter tiếp
      </p>
    </div>
  )
}
