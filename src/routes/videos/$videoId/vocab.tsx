import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { BookmarkCheck, Keyboard, Loader2, Play, Sparkles } from 'lucide-react'

import { VocabPractice, clipFor, splitAround } from '#/components/vocab-practice'
import { WordLookupCard } from '#/components/word-lookup-card'
import type { LookupTarget } from '#/components/word-lookup-card'
import type { VocabItem } from '#/components/vocab-practice'
import { Button } from '#/components/ui/button'
import { Switch } from '#/components/ui/switch'
import { useStoredToggle } from '#/hooks/use-stored-toggle'
import { VOCAB_LEVELS, posVi } from '#/lib/levels'
import { playerActions } from '#/lib/player-store'
import { videoPhrasesQuery, videoQuery, videoVocabQuery, vocabMeaningsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import type { VocabLevel } from '#/lib/levels'
import { videoPhrases } from '#/server/fns/vocab'
import type { SegmentView } from '#/server/fns/videos'

export const Route = createFileRoute('/videos/$videoId/vocab')({
  component: VocabMode,
})

const videoRoute = getRouteApi('/videos/$videoId')

const PHRASES = 'phrases' as const
type Filter = VocabLevel | typeof PHRASES
const FILTER_KEY = 'video-vocab.filters'
/** mặc định bỏ A1/A2: người học shadowing thường đã biết */
const DEFAULT_FILTERS: Filter[] = ['B1', 'B2', 'C1', 'C2', PHRASES]

function useFilters() {
  const [filters, setFilters] = useState<Filter[]>(DEFAULT_FILTERS)
  // đọc sau khi mount để HTML render ở server khớp lần render đầu
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_KEY) ?? 'null') as unknown
      if (Array.isArray(saved)) setFilters(saved as Filter[])
    } catch {
      /* private mode */
    }
  }, [])
  const toggle = (f: Filter) => {
    const next = filters.includes(f) ? filters.filter((x) => x !== f) : [...filters, f]
    setFilters(next)
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(next))
    } catch {
      /* private mode */
    }
  }
  return [filters, toggle] as const
}

function VocabMode() {
  const { videoId } = videoRoute.useParams()
  const { data: video } = useSuspenseQuery(videoQuery(videoId))
  const [filters, toggle] = useFilters()
  const [hideSaved, setHideSaved] = useStoredToggle('video-vocab.hide-saved')
  const [practice, setPractice] = useState<VocabItem[] | null>(null)

  const vocab = useQuery(videoVocabQuery(videoId))
  const wantPhrases = filters.includes(PHRASES)
  // chỉ đọc cache ở server (không gọi AI) → luôn hỏi để có từ loại theo ngữ cảnh nếu đã tìm
  const phrases = useQuery(videoPhrasesQuery(videoId))
  const aiPos = phrases.data?.status === 'ready' ? phrases.data.wordPos : {}
  const [lookup, setLookup] = useState<LookupTarget | null>(null)
  const closeLookup = useCallback(() => setLookup(null), [])
  const queryClient = useQueryClient()
  const findPhrases = useMutation({
    mutationFn: () => videoPhrases({ data: { youtubeId: videoId, generate: true } }),
    onSuccess: (res) => queryClient.setQueryData(videoPhrasesQuery(videoId).queryKey, res),
  })

  const meanings = useQuery(vocabMeaningsQuery(videoId, (vocab.data ?? []).map((w) => w.lemma)))
  const words: VocabItem[] = (vocab.data ?? []).map((w) => ({
    key: `w:${w.lemma}`,
    text: w.lemma,
    surface: w.surface,
    segIdx: w.segIdx,
    level: w.level,
    // từ loại theo ngữ cảnh câu (AI) nếu đã tìm, không thì theo danh sách CEFR-J
    pos: posVi(w.lemma in aiPos ? [aiPos[w.lemma]] : w.pos),
    count: w.count,
    meaningVi: meanings.data?.[w.lemma],
    saved: w.saved,
  }))
  const phraseItems: VocabItem[] = (phrases.data?.status === 'ready' ? phrases.data.phrases : []).map((p) => ({
    key: `p:${p.phrase.toLowerCase()}`,
    text: p.phrase,
    surface: p.surface,
    segIdx: p.segment,
    level: p.level,
    kind: p.kind,
    meaningVi: p.meaningVi,
    saved: p.saved,
  }))

  const visible = (list: VocabItem[]) => list.filter((w) => !hideSaved || !w.saved)
  const sections = [
    ...VOCAB_LEVELS.filter((l) => filters.includes(l)).map((l) => ({
      key: l,
      title: l,
      items: visible(words.filter((w) => w.level === l)),
    })),
    ...(wantPhrases ? [{ key: PHRASES as Filter, title: 'Cụm từ', items: visible(phraseItems) }] : []),
  ]
  const shown = sections.flatMap((s) => s.items)
  const segments = new Map(video.segments.map((s) => [s.idx, s]))

  const startPractice = (from?: VocabItem) => {
    // cụm AI chép sai nguyên văn thì không che/gõ được
    const list = shown.filter((w) => w.surface)
    const at = from ? list.findIndex((w) => w.key === from.key) : 0
    setPractice([...list.slice(Math.max(at, 0)), ...list.slice(0, Math.max(at, 0))])
  }

  if (practice)
    return <VocabPractice youtubeId={videoId} items={practice} segments={video.segments} onExit={() => setPractice(null)} />

  const countOf = (f: Filter) =>
    visible(f === PHRASES ? phraseItems : words.filter((w) => w.level === f)).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {[...VOCAB_LEVELS, PHRASES].map((f: Filter) => {
          const on = filters.includes(f)
          const loading = f === PHRASES ? phrases.isFetching || findPhrases.isPending : vocab.isLoading
          return (
            <button
              key={f}
              type="button"
              onClick={() => toggle(f)}
              aria-pressed={on}
              className={cn(
                'flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                on ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f === PHRASES ? 'Cụm từ' : f}
              {loading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                (f !== PHRASES || phrases.data?.status === 'ready') && <span className="text-xs opacity-70">{countOf(f)}</span>
              )}
            </button>
          )
        })}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={hideSaved} onCheckedChange={setHideSaved} />
          Ẩn từ đã lưu
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {shown.length} từ/cụm trong bài. Bấm ▶ để nghe câu chứa từ.
          {meanings.isFetching && <Loader2 className="ml-1.5 inline size-3.5 animate-spin" />}
        </p>
        <Button onClick={() => startPractice()} disabled={!shown.some((w) => w.surface)}>
          <Keyboard />
          Luyện gõ
        </Button>
      </div>

      {vocab.error && <p className="text-sm text-destructive">{vocab.error.message}</p>}
      {wantPhrases && phrases.error && <p className="text-sm text-destructive">Cụm từ: {phrases.error.message}</p>}
      {wantPhrases && phrases.data?.status === 'no-ai' && (
        <p className="text-sm text-muted-foreground">Tìm cụm từ cần AI: vào Cài đặt để cấu hình nhà cung cấp AI.</p>
      )}
      {phrases.data?.status === 'idle' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <span className="flex-1">
            Chưa tìm cụm từ (phrasal verb, thành ngữ, collocation) và loại từ theo ngữ cảnh câu cho bài này.
          </span>
          <Button size="sm" variant="outline" onClick={() => findPhrases.mutate()} disabled={findPhrases.isPending}>
            {findPhrases.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {findPhrases.isPending ? 'Đang tìm…' : 'Tìm bằng AI'}
          </Button>
        </div>
      )}
      {findPhrases.error && <p className="text-sm text-destructive">Cụm từ: {findPhrases.error.message}</p>}

      {sections.map(
        (s) =>
          s.items.length > 0 && (
            <section key={s.key} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {s.title} · {s.items.length}
              </h3>
              <ul className="divide-y rounded-xl border bg-card">
                {s.items.map((w) => (
                  <VocabRow
                    key={w.key}
                    item={w}
                    seg={segments.get(w.segIdx)}
                    onPractice={() => startPractice(w)}
                    onLookup={setLookup}
                  />
                ))}
              </ul>
            </section>
          ),
      )}

      <p className="text-xs text-muted-foreground">
        Cấp từ đơn theo{' '}
        <a href="https://github.com/openlanguageprofiles/olp-en-cefrj" target="_blank" rel="noreferrer">
          CEFR-J Wordlist 1.5 (Tono Lab, TUFS) và Octanove Vocabulary Profile C1/C2 (CC BY-SA 4.0)
        </a>
        ; cụm từ và loại từ theo ngữ cảnh do AI chọn. Bấm vào từ để xem nghĩa theo câu.
      </p>
      {lookup && <WordLookupCard target={lookup} onClose={closeLookup} autoAi={false} />}
    </div>
  )
}

function VocabRow({
  item,
  seg,
  onPractice,
  onLookup,
}: {
  item: VocabItem
  seg?: SegmentView
  onPractice: () => void
  /** mở thẻ tra từ (từ điển + nghĩa AI theo đúng câu, lưu thẻ) ngay dưới từ */
  onLookup: (target: LookupTarget) => void
}) {
  const parts = seg && item.surface ? splitAround(seg.text, item.surface) : null
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <Button
        size="icon"
        variant="ghost"
        className="size-8 shrink-0"
        disabled={!seg}
        onClick={() => seg && playerActions.playRange(seg.startMs, seg.endMs)}
        title="Nghe câu chứa từ"
      >
        <Play />
      </Button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <button
            type="button"
            className="font-semibold underline-offset-4 hover:text-primary hover:underline disabled:no-underline"
            disabled={!seg}
            title="Xem nghĩa theo câu"
            onClick={(e) => {
              if (!seg) return
              const rect = e.currentTarget.getBoundingClientRect()
              const clip = clipFor(seg, item.surface || item.text)
              onLookup({
                text: item.text,
                sentence: seg.text,
                segmentId: seg.id,
                startMs: clip.startMs,
                endMs: clip.endMs,
                rect: { top: rect.top, bottom: rect.bottom, left: rect.left },
              })
            }}
          >
            {item.text}
          </button>
          {(item.kind ?? item.pos) && (
            <span className="text-xs text-muted-foreground">{item.kind ?? item.pos}</span>
          )}
          {item.count != null && item.count > 1 && (
            <span className="text-xs text-muted-foreground">×{item.count}</span>
          )}
          {item.saved && <BookmarkCheck className="size-3.5 self-center text-ok" aria-label="Đã lưu thẻ" />}
          {item.meaningVi && <span className="text-sm text-muted-foreground">{item.meaningVi}</span>}
        </div>
        {seg && (
          <p className="truncate text-sm text-muted-foreground">
            {parts ? (
              <>
                {parts[0]}
                <mark className="rounded bg-primary/10 px-0.5 text-foreground">{parts[1]}</mark>
                {parts[2]}
              </>
            ) : (
              seg.text
            )}
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={onPractice} disabled={!item.surface}>
        Gõ
      </Button>
    </li>
  )
}
