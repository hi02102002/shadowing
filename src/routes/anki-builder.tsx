import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpen,
  Check,
  Download,
  Link2,
  ListPlus,
  Loader2,
  Pencil,
  Play,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import {
  PRESET_BOOKS,
  bingImageUrl,
  findMatchingWordForPhrase,
  normalizePartOfSpeech,
  parseCustomWords,
  youdaoVoiceUrl,
} from '#/lib/anki-builder'
import type {
  AnyAnkiCard,
  ExtractedNote,
  LessonAnalysis,
  LexicalChunk,
  NoteCard,
  VocabularyCard,
} from '#/lib/anki-builder'
import { cn } from '#/lib/utils'
import {
  analyzeLesson,
  generateChunks,
  generateNotes,
  generateVocabulary,
} from '#/server/fns/anki-builder'

export const Route = createFileRoute('/anki-builder')({
  head: () => ({ meta: [{ title: 'Tạo thẻ Anki · Shadowing' }] }),
  component: AnkiBuilderPage,
})

type Step = 1 | 2 | 3
type InputMode = 'preset' | 'url' | 'text'

const STEPS = ['Nguồn dữ liệu', 'Chọn nội dung', 'Xem trước & xuất thẻ']
const VOCAB_BATCH = 4
const NOTE_BATCH = 3

const play = (url: string) => {
  if (url) void new Audio(url).play().catch(() => undefined)
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

function AnkiBuilderPage() {
  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<InputMode>('preset')
  const vocabBooks = PRESET_BOOKS.filter((b) => b.category !== 'grammar')
  const [book, setBook] = useState(vocabBooks[0].slug)
  const [unit, setUnit] = useState(9)
  const [url, setUrl] = useState('')
  const [urlUnit, setUrlUnit] = useState('')
  const [rawText, setRawText] = useState('')
  const [deckName, setDeckName] = useState('English Vocabulary in Use')

  const [lesson, setLesson] = useState<LessonAnalysis | null>(null)
  const [words, setWords] = useState<string[]>([])
  const [phrases, setPhrases] = useState<string[]>([])
  const [notes, setNotes] = useState<ExtractedNote[]>([])
  const [off, setOff] = useState<Set<string>>(new Set()) // mục bị bỏ chọn (khoá: w:/p:/n:)
  const [hints, setHints] = useState<Record<string, string>>({})
  const [images, setImages] = useState<Record<string, string>>({})
  const [wordFilter, setWordFilter] = useState('')
  const [phraseFilter, setPhraseFilter] = useState('')
  const [merge, setMerge] = useState(true)

  const [cards, setCards] = useState<AnyAnkiCard[]>([])
  const [cardType, setCardType] = useState<'all' | 'word' | 'phrase' | 'note'>(
    'all',
  )
  const [editing, setEditing] = useState<number | null>(null)

  const [busy, setBusy] = useState<
    null | 'analyze' | 'generate' | 'chunks' | 'export'
  >(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const isOn = (key: string) => !off.has(key)
  const toggle = (key: string) =>
    setOff((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const setAll = (keys: string[], on: boolean) =>
    setOff((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (on) next.delete(k)
        else next.add(k)
      }
      return next
    })

  const selWords = useMemo(
    () => words.filter((w) => isOn(`w:${w}`)),
    [words, off],
  )
  const selPhrases = useMemo(
    () => phrases.filter((p) => isOn(`p:${p}`)),
    [phrases, off],
  )
  const selNotes = useMemo(
    () => notes.filter((n) => isOn(`n:${n.id}`)),
    [notes, off],
  )
  const standalone = selPhrases.filter(
    (p) => !findMatchingWordForPhrase(p, selWords),
  )
  const estimate = merge
    ? selWords.length + standalone.length + selNotes.length
    : selWords.length + selPhrases.length + selNotes.length

  const loadItems = (
    nextWords: string[],
    nextPhrases: string[],
    nextNotes: ExtractedNote[],
    grammar: boolean,
  ) => {
    setWords(nextWords)
    setPhrases(nextPhrases)
    setNotes(nextNotes)
    // bài từ vựng: ghi chú mặc định tắt (nhiều, chỉ bật khi cần); bài ngữ pháp: bật
    setOff(new Set(grammar ? [] : nextNotes.map((n) => `n:${n.id}`)))
    setWordFilter('')
    setPhraseFilter('')
    setCards([])
  }

  async function onAnalyze() {
    setError('')
    setBusy('analyze')
    setStatus('Đang phân tích bài học từ nguồn dữ liệu…')
    try {
      const result = await analyzeLesson({
        data: {
          bookSlug: mode === 'preset' ? book : undefined,
          unitNumber:
            mode === 'preset'
              ? unit
              : urlUnit.trim()
                ? Number(urlUnit)
                : undefined,
          url: mode === 'url' ? url.trim() : undefined,
        },
      })
      setLesson(result)
      loadItems(
        result.words,
        result.phrases,
        result.notes,
        Boolean(result.isGrammar),
      )
      const nextHints: Record<string, string> = {}
      const nextImages: Record<string, string> = {}
      for (const item of result.vocabularyList) {
        if (item.hint) nextHints[item.word] = item.hint
        if (item.image) nextImages[item.word] = item.image
      }
      setHints(nextHints)
      setImages(nextImages)
      const prefix = result.bookTitle || 'English Vocabulary in Use'
      const title =
        result.title
          .replace(
            /^(?:English Vocabulary in Use|English Grammar in Use)\s*[:-]?\s*/i,
            '',
          )
          .trim() || result.title
      setDeckName(`${prefix}::${title}`)
      setStatus(
        `Đã bóc tách: ${result.words.length} từ vựng, ${result.phrases.length} cụm từ, ${result.notes.length} phần ghi chú.`,
      )
      setStep(2)
    } catch (err) {
      setStatus('')
      setError(errorMessage(err, 'Không thể đọc bài học'))
    } finally {
      setBusy(null)
    }
  }

  function onProceedWithText() {
    const parsed = parseCustomWords(rawText)
    if (!parsed.length) return setError('Vui lòng nhập ít nhất 1 từ vựng.')
    setError('')
    const nextPhrases = parsed.filter((p) => p.includes(' ') || p.includes('-'))
    const nextWords = parsed.filter((p) => !nextPhrases.includes(p))
    setLesson(null)
    loadItems(nextWords, nextPhrases, [], false)
    setHints({})
    setImages({})
    setStatus(
      `Đã ghi nhận ${nextWords.length} từ vựng và ${nextPhrases.length} cụm từ.`,
    )
    setStep(2)
  }

  async function onGenerateChunks() {
    const candidates = selWords.length ? selWords : words
    if (!candidates.length)
      return setError('Cần ít nhất 1 từ vựng để tạo chunks.')
    setError('')
    setBusy('chunks')
    setStatus('Đang dùng AI tạo thêm cụm từ Lexical Chunks…')
    try {
      const generated = await generateChunks({
        data: {
          words: candidates.slice(0, 30),
          storyText:
            lesson?.notes.map((n) => n.content.join(' ')).join('\n') ||
            undefined,
          topic: lesson?.unitTitle || deckName,
        },
      })
      const have = new Set(phrases.map((p) => p.toLowerCase()))
      const added = generated.filter(
        (g) => g.word && !have.has(g.word.toLowerCase()),
      )
      if (!added.length) return setStatus('AI không trả về chunk mới nào.')
      setPhrases((prev) => [...prev, ...added.map((g) => g.word)])
      setHints((prev) => ({
        ...prev,
        ...Object.fromEntries(added.map((g) => [g.word, g.vietnamese])),
      }))
      setStatus(`Đã thêm ${added.length} chunks từ AI vào danh sách cụm từ.`)
    } catch (err) {
      setStatus('')
      setError(errorMessage(err, 'Không tạo được chunks'))
    } finally {
      setBusy(null)
    }
  }

  async function onGenerateCards() {
    const matched: Record<string, string[]> = {}
    const orphans: string[] = []
    if (merge) {
      for (const p of selPhrases) {
        const w = findMatchingWordForPhrase(p, selWords)
        if (w) (matched[w] ??= []).push(p)
        else orphans.push(p)
      }
    }
    const items = Array.from(
      new Set(
        (merge ? [...selWords, ...orphans] : [...selWords, ...selPhrases])
          .map((w) => w.replace(/\s+(?:n|v|adj|adv)[.,]?$/i, '').trim())
          .filter((w) => w && w.length <= 300),
      ),
    )
    if (!items.length && !selNotes.length)
      return setError('Vui lòng chọn ít nhất 1 từ vựng, cụm từ hoặc ghi chú.')

    setError('')
    setBusy('generate')
    const topic = lesson?.unitTitle || deckName
    const source = lesson?.sourceUrl ?? 'custom-input'
    try {
      const vocab = []
      for (let i = 0; i < items.length; i += VOCAB_BATCH) {
        setStatus(
          `AI đang tạo thẻ từ vựng: ${Math.min(i + VOCAB_BATCH, items.length)} / ${items.length}…`,
        )
        vocab.push(
          ...(await generateVocabulary({
            data: {
              words: items.slice(i, i + VOCAB_BATCH),
              topic,
              phrases: selPhrases.slice(0, 300),
            },
          })),
        )
      }
      const richNotes = []
      for (let i = 0; i < selNotes.length; i += NOTE_BATCH) {
        setStatus(
          `AI đang làm giàu ghi chú: ${Math.min(i + NOTE_BATCH, selNotes.length)} / ${selNotes.length}…`,
        )
        richNotes.push(
          ...(await generateNotes({
            data: {
              notes: selNotes
                .slice(i, i + NOTE_BATCH)
                .map((n) => ({ title: n.title, content: n.content })),
            },
          })),
        )
      }
      if (!vocab.length && !richNotes.length)
        throw new Error(
          'Không nhận được dữ liệu hợp lệ từ AI. Kiểm tra cấu hình AI trong Cài đặt.',
        )

      const phraseSet = new Set(selPhrases)
      const stamp = Date.now()
      const out: VocabularyCard[] = []
      const made = new Set<string>()
      vocab.forEach((item, index) => {
        if (!item.word) return
        const isPhrase = phraseSet.has(item.word) || item.word.includes(' ')
        const chunks: LexicalChunk[] = (item.chunks ?? []).map((c) => ({
          ...c,
          imageUrl: bingImageUrl(c.imageQuery || c.text),
          audioUrl: youdaoVoiceUrl(c.text),
          exampleAudioUrl: c.example ? youdaoVoiceUrl(c.example) : '',
        }))
        // gộp cụm từ của bài học vào mặt sau thẻ của từ gốc
        const seen = new Set(chunks.map((c) => c.text.toLowerCase()))
        for (const mp of matched[item.word] ?? []) {
          const lower = mp.toLowerCase()
          if (
            [...seen].some(
              (t) => t === lower || t.includes(lower) || lower.includes(t),
            )
          )
            continue
          seen.add(lower)
          chunks.push({
            text: mp,
            ipa: '',
            meaningVi: hints[mp] || item.vietnamese,
            englishDefinition: `Common collocation related to "${item.word}".`,
            example: '',
            imageQuery: mp,
            imageUrl: images[mp] || bingImageUrl(mp),
            partOfSpeech: 'phrase',
            audioUrl: youdaoVoiceUrl(mp),
            exampleAudioUrl: '',
          })
        }
        made.add(item.word.toLowerCase())
        out.push({
          type: 'vocabulary',
          id: `vocab-${stamp}-${index}`,
          selected: true,
          unitNumber: lesson?.unitNumber,
          kind: isPhrase ? 'phrase' : 'word',
          hint: hints[item.word],
          word: item.word,
          ipa: item.ipa,
          vietnamese: item.vietnamese,
          englishDefinition: item.englishDefinition,
          example: item.example,
          imageQuery: item.imageQuery,
          chunks,
          partOfSpeech: item.partOfSpeech || (isPhrase ? 'phrase' : 'noun'),
          imageUrl: images[item.word] || bingImageUrl(item.imageQuery),
          wordAudioUrl: youdaoVoiceUrl(item.word),
          exampleAudioUrl: item.example ? youdaoVoiceUrl(item.example) : '',
          sourceUrl: source,
        })
        // tắt gộp: mỗi chunk của AI thành một thẻ riêng
        if (!merge) {
          for (const [ci, c] of chunks.entries()) {
            const text = c.text.trim()
            if (!text || made.has(text.toLowerCase())) continue
            made.add(text.toLowerCase())
            out.push({
              type: 'vocabulary',
              id: `vocab-chunk-${stamp}-${index}-${ci}`,
              selected: true,
              unitNumber: lesson?.unitNumber,
              kind: 'phrase',
              partOfSpeech: c.partOfSpeech || 'phrase',
              word: text,
              ipa: c.ipa ?? '',
              vietnamese: c.meaningVi || item.vietnamese,
              englishDefinition:
                c.englishDefinition ||
                `Common lexical chunk related to "${item.word}".`,
              example: c.example || item.example,
              imageQuery: c.imageQuery ?? text,
              imageUrl: c.imageUrl ?? bingImageUrl(text),
              wordAudioUrl: c.audioUrl ?? youdaoVoiceUrl(text),
              exampleAudioUrl: c.exampleAudioUrl || '',
              sourceUrl: source,
              hint: `Lexical Chunk đi liền với "${item.word}"`,
            })
          }
        }
      })
      const noteCards: NoteCard[] = richNotes.map((n, i) => ({
        type: 'note',
        id: `note-${stamp}-${i}`,
        selected: true,
        unitNumber: lesson?.unitNumber,
        title: n.title || 'Note',
        content: n.content,
        vietnameseExplanation: n.vietnameseExplanation,
        example: n.example,
        exampleAudioUrl: n.example ? youdaoVoiceUrl(n.example) : '',
        sourceUrl: source,
      }))
      setCards([...out, ...noteCards])
      setEditing(null)
      setStatus(
        `Đã tạo ${out.length + noteCards.length} thẻ (${out.length} từ/cụm từ, ${noteCards.length} ghi chú).`,
      )
      setStep(3)
    } catch (err) {
      setStatus('')
      setError(errorMessage(err, 'Không thể tạo thẻ Anki'))
    } finally {
      setBusy(null)
    }
  }

  const patchCard = (
    index: number,
    patch: Partial<VocabularyCard> & Partial<NoteCard>,
  ) =>
    setCards((cur) =>
      cur.map((c, i) => {
        if (i !== index) return c
        const next = { ...c, ...patch } as AnyAnkiCard
        // đổi chữ thì giọng đọc / ảnh theo chữ mới
        if (next.type === 'vocabulary') {
          if (patch.word !== undefined)
            next.wordAudioUrl = youdaoVoiceUrl(patch.word)
          if (patch.imageQuery !== undefined)
            next.imageUrl = bingImageUrl(patch.imageQuery)
          if (patch.example !== undefined)
            next.exampleAudioUrl = youdaoVoiceUrl(patch.example)
        } else if (patch.example !== undefined) {
          next.exampleAudioUrl = youdaoVoiceUrl(patch.example)
        }
        return next
      }),
    )

  async function onExport() {
    setError('')
    setBusy('export')
    setStatus('Đang gửi yêu cầu xuất…')
    try {
      const res = await fetch('/api/anki-build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deckName: deckName.trim() || 'Anki deck',
          cards,
        }),
      })
      const started = (await res.json()) as {
        jobId?: string
        total?: number
        error?: string
      }
      if (!res.ok || !started.jobId)
        throw new Error(started.error || 'Không bắt đầu được việc xuất file')
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000))
        const poll = await fetch(`/api/anki-build?jobId=${started.jobId}`)
        const job = (await poll.json()) as {
          status?: string
          processed?: number
          total?: number
          error?: string
        }
        if (!poll.ok) throw new Error(job.error || 'Mất tác vụ xuất file')
        if (job.status === 'error')
          throw new Error(job.error || 'Xuất file thất bại')
        if (job.status === 'completed') break
        setStatus(
          `Đang tải ảnh/audio và đóng gói: ${job.processed ?? 0} / ${job.total ?? started.total} thẻ…`,
        )
      }
      window.location.assign(
        `/api/anki-build?jobId=${started.jobId}&download=1`,
      )
      setStatus('Đã tạo xong file .apkg, trình duyệt đang tải về.')
    } catch (err) {
      setStatus('')
      setError(errorMessage(err, 'Xuất file thất bại'))
    } finally {
      setBusy(null)
    }
  }

  const selectedCards = cards.filter((c) => c.selected)
  const shown = cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) =>
      cardType === 'all'
        ? true
        : cardType === 'note'
          ? c.type === 'note'
          : c.type === 'vocabulary' &&
            (c.kind === 'phrase' ? 'phrase' : 'word') === cardType,
    )

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="size-6 text-primary" />
          Tạo thẻ Anki bằng AI
        </h1>
        <p className="text-muted-foreground">
          Biến bài học từ vựng essentialenglish.review hoặc danh sách từ tự do
          thành bộ thẻ Anki (.apkg) có âm thanh phát âm UK và hình minh hoạ.
        </p>
      </header>

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step
          return (
            <li
              key={label}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1',
                step === n
                  ? 'border-primary bg-primary/10 text-primary'
                  : step > n
                    ? 'text-ok'
                    : 'text-muted-foreground',
              )}
            >
              <span className="grid size-5 place-items-center rounded-full border text-xs">
                {step > n ? <Check className="size-3" /> : n}
              </span>
              {label}
            </li>
          )
        })}
      </ol>

      {(status || error) && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-sm',
            error
              ? 'border-destructive/50 text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {error || status}
        </div>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['preset', 'Chọn sách + Unit', BookOpen],
                ['url', 'Link bài học / data.json', Link2],
                ['text', 'Dán danh sách từ', ListPlus],
              ] as const
            ).map(([key, label, Icon]) => (
              <Button
                key={key}
                size="sm"
                variant={mode === key ? 'default' : 'outline'}
                onClick={() => setMode(key)}
              >
                <Icon /> {label}
              </Button>
            ))}
          </div>

          {mode === 'preset' && (
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <label className="flex flex-col gap-1 text-sm">
                Bộ sách
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={book}
                  onChange={(e) => setBook(e.target.value)}
                >
                  {vocabBooks.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.title} ({b.level})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Unit
                <Input
                  type="number"
                  min={1}
                  max={
                    vocabBooks.find((b) => b.slug === book)?.totalUnits ?? 100
                  }
                  value={unit}
                  onChange={(e) =>
                    setUnit(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </label>
            </div>
          )}

          {mode === 'url' && (
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <label className="flex flex-col gap-1 text-sm">
                URL bài học (/apps/…/unit-9-…) hoặc link data.json
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.essentialenglish.review/apps/…/unit-9-the-body-and-movement"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Unit (nếu là data.json)
                <Input
                  type="number"
                  min={1}
                  value={urlUnit}
                  onChange={(e) => setUrlUnit(e.target.value)}
                />
              </label>
            </div>
          )}

          {mode === 'text' && (
            <label className="flex flex-col gap-1 text-sm">
              Danh sách từ / cụm từ (mỗi dòng hoặc cách nhau bằng dấu phẩy)
              <Textarea
                rows={8}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={'take a deep breath\nsore throat\nstretch'}
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            Tên bộ thẻ (dùng "::" để tạo deck con trong Anki)
            <Input
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
            />
          </label>

          <div className="flex justify-end">
            {mode === 'text' ? (
              <Button onClick={onProceedWithText}>Tiếp tục</Button>
            ) : (
              <Button
                disabled={busy === 'analyze' || (mode === 'url' && !url.trim())}
                onClick={() => void onAnalyze()}
              >
                {busy === 'analyze' && <Loader2 className="animate-spin" />}
                Phân tích bài học
              </Button>
            )}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-5">
          {lesson && (
            <p className="text-sm text-muted-foreground">
              {lesson.bookTitle} · {lesson.title}
            </p>
          )}
          <PickList
            title="Từ vựng"
            prefix="w:"
            items={words}
            filter={wordFilter}
            onFilter={setWordFilter}
            isOn={isOn}
            onToggle={toggle}
            onAll={setAll}
          />
          <PickList
            title="Cụm từ / thành ngữ"
            prefix="p:"
            items={phrases}
            filter={phraseFilter}
            onFilter={setPhraseFilter}
            isOn={isOn}
            onToggle={toggle}
            onAll={setAll}
            extra={
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || !words.length}
                onClick={() => void onGenerateChunks()}
              >
                {busy === 'chunks' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                Thêm chunks bằng AI
              </Button>
            }
          />
          {notes.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">
                  Ghi chú bài học (Language Notes)
                </h2>
                <span className="flex gap-2 text-sm">
                  <button
                    className="text-primary hover:underline"
                    onClick={() =>
                      setAll(
                        notes.map((n) => `n:${n.id}`),
                        true,
                      )
                    }
                  >
                    Chọn tất cả
                  </button>
                  <button
                    className="text-muted-foreground hover:underline"
                    onClick={() =>
                      setAll(
                        notes.map((n) => `n:${n.id}`),
                        false,
                      )
                    }
                  >
                    Bỏ chọn
                  </button>
                </span>
              </div>
              {notes.map((n) => (
                <label
                  key={n.id}
                  className="flex items-start gap-2 rounded-lg border p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-primary"
                    checked={isOn(`n:${n.id}`)}
                    onChange={() => toggle(`n:${n.id}`)}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{n.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {n.content.slice(0, 2).join(' · ')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary"
              checked={merge}
              onChange={(e) => setMerge(e.target.checked)}
            />
            Gộp cụm từ liên quan vào mặt sau thẻ của từ gốc (không tạo thẻ
            riêng)
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft /> Quay lại
            </Button>
            <Button
              disabled={busy !== null || estimate === 0}
              onClick={() => void onGenerateCards()}
            >
              {busy === 'generate' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              Tạo khoảng {estimate} thẻ bằng AI
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Tên bộ thẻ
            <Input
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['all', 'Tất cả'],
                ['word', 'Từ vựng'],
                ['phrase', 'Cụm từ'],
                ['note', 'Ghi chú'],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={cardType === key ? 'default' : 'outline'}
                onClick={() => setCardType(key)}
              >
                {label}
              </Button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">
              {selectedCards.length}/{cards.length} thẻ được chọn
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            {shown.map(({ c, i }) => (
              <CardItem
                key={c.id}
                card={c}
                editing={editing === i}
                onEdit={() => setEditing(editing === i ? null : i)}
                onPatch={(patch) => patchCard(i, patch)}
                onRemove={() =>
                  setCards((cur) => cur.filter((_, j) => j !== i))
                }
              />
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft /> Quay lại
            </Button>
            <Button
              disabled={busy !== null || selectedCards.length === 0}
              onClick={() => void onExport()}
            >
              {busy === 'export' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              Tải file .apkg ({selectedCards.length} thẻ)
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}

function PickList({
  title,
  prefix,
  items,
  filter,
  onFilter,
  isOn,
  onToggle,
  onAll,
  extra,
}: {
  title: string
  prefix: string
  items: string[]
  filter: string
  onFilter: (v: string) => void
  isOn: (key: string) => boolean
  onToggle: (key: string) => void
  onAll: (keys: string[], on: boolean) => void
  extra?: React.ReactNode
}) {
  const q = filter.trim().toLowerCase()
  const shown = q ? items.filter((w) => w.toLowerCase().includes(q)) : items
  const keys = shown.map((w) => `${prefix}${w}`)
  const count = items.filter((w) => isOn(`${prefix}${w}`)).length
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium">
          {title}{' '}
          <span className="text-sm font-normal text-muted-foreground">
            ({count}/{items.length})
          </span>
        </h2>
        <div className="relative ml-auto w-48">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Lọc…"
            value={filter}
            onChange={(e) => onFilter(e.target.value)}
          />
        </div>
        <button
          className="text-sm text-primary hover:underline"
          onClick={() => onAll(keys, true)}
        >
          Chọn tất cả
        </button>
        <button
          className="text-sm text-muted-foreground hover:underline"
          onClick={() => onAll(keys, false)}
        >
          Bỏ chọn
        </button>
        {extra}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có mục nào.</p>
      ) : (
        <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
          {shown.map((w) => {
            const on = isOn(`${prefix}${w}`)
            return (
              <button
                key={w}
                type="button"
                onClick={() => onToggle(`${prefix}${w}`)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  on
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground line-through opacity-60',
                )}
              >
                {w}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CardItem({
  card,
  editing,
  onEdit,
  onPatch,
  onRemove,
}: {
  card: AnyAnkiCard
  editing: boolean
  onEdit: () => void
  onPatch: (patch: Partial<VocabularyCard> & Partial<NoteCard>) => void
  onRemove: () => void
}) {
  const head = (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        className="accent-primary"
        checked={card.selected}
        onChange={(e) => onPatch({ selected: e.target.checked })}
      />
      {card.type === 'vocabulary' ? (
        <>
          <Badge variant="secondary">
            {normalizePartOfSpeech(card.partOfSpeech) ||
              (card.kind === 'phrase' ? 'phrase' : 'word')}
          </Badge>
          <span className="text-lg font-semibold">{card.word}</span>
          {card.ipa && (
            <span className="text-sm text-muted-foreground">{card.ipa}</span>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            title="Nghe (UK)"
            onClick={() => play(card.wordAudioUrl)}
          >
            <Play />
          </Button>
        </>
      ) : (
        <>
          <Badge variant="secondary">Ghi chú</Badge>
          <span className="font-semibold">{card.title}</span>
        </>
      )}
      <span className="ml-auto flex gap-1">
        <Button size="icon-sm" variant="ghost" title="Sửa" onClick={onEdit}>
          <Pencil />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Xoá thẻ"
          className="hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </span>
    </div>
  )

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-xl border bg-card p-4',
        !card.selected && 'opacity-50',
      )}
    >
      {head}
      {card.type === 'vocabulary' ? (
        editing ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label="Từ / cụm từ"
              value={card.word}
              onChange={(word) => onPatch({ word })}
            />
            <Field
              label="IPA"
              value={card.ipa}
              onChange={(ipa) => onPatch({ ipa })}
            />
            <Field
              label="Nghĩa tiếng Việt"
              value={card.vietnamese}
              onChange={(vietnamese) => onPatch({ vietnamese })}
            />
            <Field
              label="Từ khoá ảnh (Bing)"
              value={card.imageQuery}
              onChange={(imageQuery) => onPatch({ imageQuery })}
            />
            <Field
              wide
              label="Định nghĩa tiếng Anh"
              value={card.englishDefinition}
              onChange={(englishDefinition) => onPatch({ englishDefinition })}
            />
            <Field
              wide
              label="Câu ví dụ"
              value={card.example}
              onChange={(example) => onPatch({ example })}
            />
          </div>
        ) : (
          <div className="flex gap-3">
            {card.imageUrl && (
              <img
                src={card.imageUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-20 w-28 shrink-0 rounded-md object-cover"
              />
            )}
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <p className="font-medium">🇻🇳 {card.vietnamese}</p>
              <p className="text-muted-foreground">{card.englishDefinition}</p>
              {card.example && (
                <p className="italic">
                  {card.example}{' '}
                  <button
                    className="align-middle text-primary"
                    title="Nghe câu"
                    onClick={() => play(card.exampleAudioUrl)}
                  >
                    <Play className="inline size-3.5" />
                  </button>
                </p>
              )}
              {(card.chunks?.length ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  🧩 {card.chunks!.map((c) => c.text).join(' · ')}
                </p>
              )}
            </div>
          </div>
        )
      ) : editing ? (
        <div className="grid gap-2">
          <Field
            label="Tiêu đề"
            value={card.title}
            onChange={(title) => onPatch({ title })}
          />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Nội dung (mỗi dòng một ý)
            <Textarea
              value={card.content.join('\n')}
              onChange={(e) => onPatch({ content: e.target.value.split('\n') })}
            />
          </label>
          <Field
            label="Giải thích tiếng Việt"
            value={card.vietnameseExplanation}
            onChange={(vietnameseExplanation) =>
              onPatch({ vietnameseExplanation })
            }
          />
          <Field
            label="Ví dụ"
            value={card.example}
            onChange={(example) => onPatch({ example })}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <ul className="list-disc pl-5">
            {card.content.slice(0, 4).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          {card.vietnameseExplanation && (
            <p className="text-muted-foreground">
              🇻🇳 {card.vietnameseExplanation}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function Field({
  label,
  value,
  onChange,
  wide,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  wide?: boolean
}) {
  return (
    <label
      className={cn(
        'flex flex-col gap-1 text-xs text-muted-foreground',
        wide && 'sm:col-span-2',
      )}
    >
      {label}
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
