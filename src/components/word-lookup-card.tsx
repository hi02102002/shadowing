import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AudioLines,
  ExternalLink,
  Lightbulb,
  Loader2,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react'

import { SaveToDeck } from '#/components/save-to-deck'
import { Button } from '#/components/ui/button'
import { playerActions } from '#/lib/player-store'
import { useAccent } from '#/hooks/use-app-settings'
import { canSpeak, speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { dictionaryEntry, lookupWord } from '#/server/fns/dictionary'
import type { DictEntry } from '#/server/dunno'

export interface LookupTarget {
  text: string
  sentence: string
  /** null: tra nhanh ở ngoài video (không có đoạn để nghe lại) */
  segmentId: number | null
  startMs: number
  endMs: number
  /** vị trí của từ trên màn hình để đặt thẻ ngay dưới/trên nó */
  rect: { top: number; bottom: number; left: number }
}

const WIDTH = 360
const GAP = 8

export function WordLookupCard({
  target,
  onClose,
  autoAi = true,
}: {
  target: LookupTarget
  onClose: () => void
  /** false: chỉ hiện nghĩa AI đã tra trước đó, muốn tra mới thì bấm nút (tab Từ vựng) */
  autoAi?: boolean
}) {
  const [askAi, setAskAi] = useState(autoAi)
  const ref = useRef<HTMLDivElement>(null)
  // đổi UK/US ở đây là đổi giọng chuẩn của cả app
  const [accent, chooseAccent] = useAccent()
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight?: number }>({
    top: target.rect.bottom + GAP,
    left: target.rect.left,
  })

  // nghĩa theo ngữ cảnh bằng AI (null khi chưa cấu hình AI)
  const query = useQuery({
    queryKey: ['lookup', target.text.toLowerCase(), target.sentence, askAi ? 'ai' : 'cache'],
    queryFn: () =>
      lookupWord({ data: { text: target.text, sentence: target.sentence, cachedOnly: !askAi } }),
    staleTime: Infinity,
    retry: false,
  })
  // từ điển Anh–Việt, không cần AI
  const dictQuery = useQuery({
    queryKey: ['dict', target.text.toLowerCase()],
    queryFn: () => dictionaryEntry({ data: { text: target.text } }),
    staleTime: Infinity,
    retry: false,
  })

  // giữ thẻ trong viewport: ưu tiên bên dưới, lật lên trên nếu chỉ trên đủ chỗ;
  // hai bên đều không đủ → đặt ở bên rộng hơn và giới hạn chiều cao để cuộn bên trong
  useLayoutEffect(() => {
    // scrollHeight: chiều cao thật của nội dung, kể cả khi đang bị giới hạn maxHeight
    const h = ref.current?.scrollHeight ?? 240
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(WIDTH, vw - GAP * 2)
    const left = Math.min(Math.max(GAP, target.rect.left), vw - width - GAP)
    const spaceBelow = vh - target.rect.bottom - GAP * 2
    const spaceAbove = target.rect.top - GAP * 2
    if (h <= spaceBelow || spaceBelow >= spaceAbove) {
      setPos({ top: target.rect.bottom + GAP, left, maxHeight: spaceBelow })
    } else {
      const height = Math.min(h, spaceAbove)
      setPos({ top: target.rect.top - GAP - height, left, maxHeight: spaceAbove })
    }
  }, [target, query.status, dictQuery.status])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && onClose()
    // cuộn trang thì đóng, cuộn nội dung bên trong thẻ thì không
    const onScroll = (e: Event) =>
      ref.current && !ref.current.contains(e.target as Node) && onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const d = query.data
  const dict = dictQuery.data
  const headword = d?.headword ?? dict?.word ?? target.text
  const ipaUk = d?.ipa ?? dict?.ipaUk ?? ''
  const ipaUs = d?.ipaUs ?? dict?.ipaUs ?? ''

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Tra từ: ${target.text}`}
      className="fixed z-50 flex flex-col overflow-y-auto overscroll-contain rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{
        top: pos.top,
        maxHeight: pos.maxHeight,
        left: pos.left,
        width: `min(${WIDTH}px, calc(100vw - ${GAP * 2}px))`,
      }}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">
            {headword}
          </h3>
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
            <IpaTag label="UK" ipa={ipaUk} active={accent === 'uk'} />
            <IpaTag label="US" ipa={ipaUs} active={accent === 'us'} />
            {d?.partOfSpeech && (
              <span className="italic">{d.partOfSpeech}</span>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="-mr-2 -mt-1 size-7"
          onClick={onClose}
          aria-label="Đóng"
        >
          <X />
        </Button>
      </header>

      <div className="mt-2 flex flex-wrap gap-2">
        {target.segmentId != null && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => playerActions.playClip(target.startMs, target.endMs)}
          >
            <AudioLines />
            Nghe trong video
          </Button>
        )}
        <SaveToDeck
          text={target.text}
          sentence={target.sentence}
          segmentId={target.segmentId}
          startMs={target.startMs}
          endMs={target.endMs}
          disabled={query.isPending}
          cachedOnly={!askAi}
        />
        {canSpeak() && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => speak(headword, { accent })}
            >
              <Volume2 />
              Giọng chuẩn
            </Button>
            <div
              className="flex rounded-md border p-0.5"
              role="group"
              aria-label="Giọng đọc"
            >
              {(['uk', 'us'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={accent === a}
                  onClick={() => {
                    chooseAccent(a)
                    speak(headword, { accent: a })
                  }}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    accent === a
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
            {/* giọng người thật: Cambridge chặn tải tự động nên mở trang để nghe */}
            <Button size="sm" variant="ghost" asChild>
              <a
                href={`https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(
                  headword.trim().toLowerCase().replace(/\s+/g, '-'),
                )}`}
                target="_blank"
                rel="noreferrer"
                title="Mở Cambridge Dictionary để nghe giọng người thật"
              >
                Cambridge
                <ExternalLink />
              </a>
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t pt-3 text-sm">
        {query.isPending && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tra nghĩa theo ngữ
            cảnh…
          </p>
        )}

        {query.isSuccess && !d && (
          askAi ? (
            !autoAi && (
              <p className="text-muted-foreground">
                Chưa cấu hình AI.{' '}
                <Link to="/settings" onClick={onClose}>
                  Mở Cài đặt AI →
                </Link>
              </p>
            )
          ) : (
            <Button size="sm" variant="outline" className="self-start" onClick={() => setAskAi(true)}>
              <Sparkles />
              Tra nghĩa theo câu bằng AI
            </Button>
          )
        )}

        {query.isError && (
          <div className="flex flex-col gap-2">
            <p className="text-destructive">{query.error.message}</p>
            <Link to="/settings" className="text-sm" onClick={onClose}>
              Mở Cài đặt AI →
            </Link>
          </div>
        )}

        {d && (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nghĩa trong câu này
              </div>
              <p className="mt-0.5 font-medium">{d.meaningInContext}</p>
              {d.otherMeanings.length > 0 && (
                <p className="mt-1 text-muted-foreground">
                  Nghĩa khác: {d.otherMeanings.join('; ')}
                </p>
              )}
            </div>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">EN:</span>{' '}
              {d.definitionEn}
            </p>
            {d.examples.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {d.examples.map((ex, i) => (
                  <li key={i} className="rounded-md bg-muted/60 px-2.5 py-1.5">
                    <button
                      type="button"
                      className="text-left hover:text-primary"
                      title="Nghe câu ví dụ"
                      onClick={() => speak(ex.en, { accent })}
                    >
                      {ex.en}
                    </button>
                    <div className="text-xs text-muted-foreground">{ex.vi}</div>
                  </li>
                ))}
              </ul>
            )}
            {d.pronunciationTip && (
              <p className="flex gap-1.5 text-muted-foreground">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-miss" />
                {d.pronunciationTip}
              </p>
            )}
          </div>
        )}

        <DictionarySection
          entry={dict}
          pending={dictQuery.isPending}
          error={dictQuery.error?.message}
          divided={!!d}
        />
      </div>
    </div>
  )
}

/** Nghĩa từ điển Anh–Việt (dunno.ai): nghĩa thông dụng, nghĩa chuyên ngành thu gọn, dạng từ, đồng/trái nghĩa */
function DictionarySection({
  entry,
  pending,
  error,
  divided,
}: {
  entry: DictEntry | null | undefined
  pending: boolean
  error: string | undefined
  divided: boolean
}) {
  if (pending) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tra từ điển…
      </p>
    )
  }
  if (error) return <p className="text-destructive">{error}</p>
  if (!entry) {
    return (
      <p className="text-muted-foreground">Không có từ này trong từ điển.</p>
    )
  }

  const common = entry.senses.filter((s) => !s.specialized)
  const specialized = entry.senses.filter((s) => s.specialized)

  return (
    <div className={cn('flex flex-col gap-2', divided && 'border-t pt-3')}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Từ điển
      </div>
      {common.map((sense) => (
        <Sense key={sense.kind + sense.means[0]} kind={sense.kind} means={sense.means} />
      ))}
      {specialized.length > 0 && (
        <details className="text-muted-foreground">
          <summary className="cursor-pointer select-none text-xs hover:text-foreground">
            Nghĩa chuyên ngành ({specialized.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {specialized.map((sense) => (
              <Sense key={sense.kind + sense.means[0]} kind={sense.kind} means={sense.means} />
            ))}
          </div>
        </details>
      )}
      {entry.forms.length > 0 && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Dạng từ:</span>{' '}
          {entry.forms.join(', ')}
        </p>
      )}
      {entry.synonyms.length > 0 && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Đồng nghĩa:</span>{' '}
          {entry.synonyms.join(', ')}
        </p>
      )}
      {entry.antonyms.length > 0 && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Trái nghĩa:</span>{' '}
          {entry.antonyms.join(', ')}
        </p>
      )}
      <a
        href={`https://dunno.ai/search/word/${encodeURIComponent(entry.word)}?hl=vi`}
        target="_blank"
        rel="noreferrer"
        className="self-end text-[11px] text-muted-foreground hover:text-foreground"
      >
        Nguồn: dunno.ai
      </a>
    </div>
  )
}

function Sense({ kind, means }: { kind: string; means: string[] }) {
  return (
    <div>
      {kind && <div className="text-xs italic text-muted-foreground">{kind}</div>}
      <ol className="list-decimal pl-5">
        {means.map((mean) => (
          <li key={mean}>{mean}</li>
        ))}
      </ol>
    </div>
  )
}

function IpaTag({
  label,
  ipa,
  active,
}: {
  label: string
  ipa: string
  active: boolean
}) {
  if (!ipa) return null
  return (
    <span className={cn('flex items-baseline gap-1', !active && 'opacity-60')}>
      <span className="text-[10px] font-semibold">{label}</span>
      <span className="ipa">{ipa}</span>
    </span>
  )
}
