import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkCheck, Loader2, LocateFixed, Sparkles } from 'lucide-react'

import { splitAround } from '#/components/vocab-practice'
import { WordLookupCard } from '#/components/word-lookup-card'
import type { LookupTarget } from '#/components/word-lookup-card'
import { Button } from '#/components/ui/button'
import { Switch } from '#/components/ui/switch'
import { useStoredToggle } from '#/hooks/use-stored-toggle'
import { VOCAB_LEVELS, posVi } from '#/lib/levels'
import type { VocabLevel } from '#/lib/levels'
import { readingMeaningsQuery, readingPhrasesQuery, readingVocabQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { readingPhrases } from '#/server/fns/reading'

const PHRASES = 'phrases' as const
type Filter = VocabLevel | typeof PHRASES
const FILTER_KEY = 'reading-vocab.levels'
/** mặc định bỏ A1/A2 như tab Từ vựng của video */
const DEFAULT_LEVELS: Filter[] = ['B1', 'B2', 'C1', 'C2', PHRASES]

/** một dòng trong danh sách: từ đơn hoặc cụm từ */
interface Item {
  key: string
  text: string
  /** nguyên văn trong câu (để tô), rỗng nếu AI chép sai */
  surface: string
  sentence: string
  level: string
  /** từ loại (tiếng Việt) hoặc loại cụm */
  tag: string
  count?: number
  meaningVi?: string
  saved: boolean
}

function useLevels() {
  const [levels, setLevels] = useState<Filter[]>(DEFAULT_LEVELS)
  // đọc sau khi mount để HTML render ở server khớp lần render đầu
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_KEY) ?? 'null') as unknown
      if (Array.isArray(saved)) setLevels(saved as Filter[])
    } catch {
      /* private mode */
    }
  }, [])
  const toggle = (l: Filter) => {
    const next = levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l]
    setLevels(next)
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(next))
    } catch {
      /* private mode */
    }
  }
  return [levels, toggle] as const
}

/**
 * Từ đơn trong bài đọc chia theo cấp CEFR, giống tab Từ vựng của video: nghĩa ngắn, câu chứa từ,
 * bấm từ để tra nghĩa theo câu và lưu thẻ, bấm ⌖ để tô câu đó trong bài.
 */
export function ReadingVocab({ id, onLocate }: { id: number; onLocate: (sentence: string) => void }) {
  const [levels, toggle] = useLevels()
  const [hideSaved, setHideSaved] = useStoredToggle('reading-vocab.hide-saved')
  const [lookup, setLookup] = useState<LookupTarget | null>(null)
  const closeLookup = useCallback(() => setLookup(null), [])
  const queryClient = useQueryClient()
  const vocab = useQuery(readingVocabQuery(id))
  const sentences = vocab.data?.sentences ?? []
  const meanings = useQuery(readingMeaningsQuery(id, (vocab.data?.words ?? []).map((w) => w.lemma)))
  // chỉ đọc cache ở server (không gọi AI): có thì dùng luôn từ loại theo ngữ cảnh
  const phrases = useQuery(readingPhrasesQuery(id))
  const findPhrases = useMutation({
    mutationFn: () => readingPhrases({ data: { id, generate: true } }),
    onSuccess: (res) => queryClient.setQueryData(readingPhrasesQuery(id).queryKey, res),
  })
  const ready = phrases.data?.status === 'ready' ? phrases.data : null
  const aiPos = ready?.wordPos ?? {}

  const words: Item[] = (vocab.data?.words ?? []).map((w) => ({
    key: `w:${w.lemma}`,
    text: w.lemma,
    surface: w.surface,
    sentence: sentences[w.segIdx] ?? '',
    level: w.level,
    // từ loại theo ngữ cảnh câu (AI) nếu đã tìm, không thì theo danh sách CEFR-J
    tag: posVi(w.lemma in aiPos ? [aiPos[w.lemma]] : w.pos),
    count: w.count,
    meaningVi: meanings.data?.[w.lemma],
    saved: w.saved,
  }))
  const phraseItems: Item[] = (ready?.phrases ?? []).map((p) => ({
    key: `p:${p.phrase.toLowerCase()}`,
    text: p.phrase,
    surface: p.surface,
    sentence: sentences[p.segment] ?? '',
    level: p.level,
    tag: p.kind,
    meaningVi: p.meaningVi,
    saved: p.saved,
  }))

  const visible = (list: Item[]) => list.filter((w) => !hideSaved || !w.saved)
  const itemsOf = (f: Filter) => visible(f === PHRASES ? phraseItems : words.filter((w) => w.level === f))
  const sections = [...VOCAB_LEVELS, PHRASES].filter((f: Filter) => levels.includes(f)).map((f: Filter) => ({ key: f, items: itemsOf(f) }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {[...VOCAB_LEVELS, PHRASES].map((f: Filter) => {
          const loading = f === PHRASES ? phrases.isFetching || findPhrases.isPending : vocab.isLoading
          return (
            <button
              key={f}
              type="button"
              onClick={() => toggle(f)}
              aria-pressed={levels.includes(f)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                levels.includes(f) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f === PHRASES ? 'Cụm từ' : f}
              {loading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                (f !== PHRASES || ready) && <span className="text-xs opacity-70">{itemsOf(f).length}</span>
              )}
            </button>
          )
        })}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={hideSaved} onCheckedChange={setHideSaved} />
          Ẩn từ đã lưu
        </label>
      </div>

      {vocab.error && <p className="text-sm text-destructive">{vocab.error.message}</p>}
      {phrases.data?.status === 'no-ai' && (
        <p className="text-sm text-muted-foreground">Tìm cụm từ cần AI: vào Cài đặt để cấu hình nhà cung cấp AI.</p>
      )}
      {phrases.data?.status === 'idle' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <span className="flex-1">Chưa tìm cụm từ (phrasal verb, thành ngữ, collocation) và loại từ theo ngữ cảnh câu cho bài này.</span>
          <Button size="sm" variant="outline" onClick={() => findPhrases.mutate()} disabled={findPhrases.isPending}>
            {findPhrases.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {findPhrases.isPending ? 'Đang tìm…' : 'Tìm bằng AI'}
          </Button>
        </div>
      )}
      {(phrases.error ?? findPhrases.error) && (
        <p className="text-sm text-destructive">Cụm từ: {(phrases.error ?? findPhrases.error)?.message}</p>
      )}

      {sections.map(
        (s) =>
          s.items.length > 0 && (
            <section key={s.key} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {s.key === PHRASES ? 'Cụm từ' : s.key} · {s.items.length}
                {meanings.isFetching && <Loader2 className="ml-1.5 inline size-3.5 animate-spin" />}
              </h3>
              <ul className="divide-y rounded-xl border bg-card">
                {s.items.map((w) => {
                  const sentence = w.sentence
                  const parts = w.surface ? splitAround(sentence, w.surface) : null
                  return (
                    <li key={w.key} className="flex items-start gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <button
                            type="button"
                            className="font-semibold underline-offset-4 hover:text-primary hover:underline"
                            title="Xem nghĩa theo câu, lưu thẻ"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setLookup({
                                text: w.text,
                                sentence,
                                segmentId: null,
                                startMs: 0,
                                endMs: 0,
                                rect: { top: rect.top, bottom: rect.bottom, left: rect.left },
                              })
                            }}
                          >
                            {w.text}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {w.tag}
                            {w.key.startsWith('p:') && ` · ${w.level}`}
                          </span>
                          {w.count != null && w.count > 1 && <span className="text-xs text-muted-foreground">×{w.count}</span>}
                          {w.saved && <BookmarkCheck className="size-3.5 self-center text-ok" aria-label="Đã lưu thẻ" />}
                          {w.meaningVi && <span className="text-muted-foreground">{w.meaningVi}</span>}
                        </div>
                        <p className="line-clamp-2 text-muted-foreground">
                          {parts ? (
                            <>
                              {parts[0]}
                              <mark className="rounded bg-primary/10 px-0.5 text-foreground">{parts[1]}</mark>
                              {parts[2]}
                            </>
                          ) : (
                            sentence
                          )}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="size-8 shrink-0" title="Tô câu này trong bài" onClick={() => onLocate(sentence)}>
                        <LocateFixed />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ),
      )}
      {!vocab.isLoading && !sections.some((s) => s.items.length) && (
        <p className="text-sm text-muted-foreground">Không có từ nào ở các cấp đang chọn.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Cấp từ theo{' '}
        <a href="https://github.com/openlanguageprofiles/olp-en-cefrj" target="_blank" rel="noreferrer">
          CEFR-J Wordlist 1.5 và Octanove Vocabulary Profile C1/C2
        </a>
        ; cụm từ và loại từ theo ngữ cảnh do AI chọn. Nhấp đúp vào từ bất kỳ trong bài cũng tra được.
      </p>
      {lookup && <WordLookupCard target={lookup} onClose={closeLookup} autoAi={false} />}
    </div>
  )
}
