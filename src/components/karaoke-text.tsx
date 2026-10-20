import { useCallback, useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'

import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { WordLookupCard } from '#/components/word-lookup-card'
import type { LookupTarget } from '#/components/word-lookup-card'
import { playerActions, playerStore } from '#/lib/player-store'
import { cn } from '#/lib/utils'
import { translateSentence, wordsIpa } from '#/server/fns/dictionary'
import type { SegmentView } from '#/server/fns/videos'

/**
 * Câu luyện tập với từ đang nói được tô sáng theo thời gian phát (timing từ phụ đề:
 * auto-caption chính xác, phụ đề thủ công ước lượng).
 *
 * - Click một từ: nghe lại đúng từ đó trong video
 * - Shift+click: chọn cụm từ từ lần click trước đến từ này rồi nghe cả cụm
 * - Chuột phải (hoặc phím Menu / Shift+F10): tra từ điển theo ngữ cảnh câu
 * - `ipa`: hiện phiên âm IPA dưới từng từ
 * - `translate`: hiện bản dịch tiếng Việt của cả câu (Google Dịch)
 */
export function KaraokeText({
  segment,
  hidden,
  ipa,
  translate,
}: {
  segment: SegmentView
  hidden?: boolean
  ipa?: boolean
  translate?: boolean
}) {
  const currentMs = useSelector(playerStore, (s) => s.currentMs)
  const words = segment.words.length
    ? segment.words
    : segment.text
        .split(' ')
        .map((w) => ({ w, s: segment.startMs, e: segment.endMs }))
  const inRange =
    currentMs >= segment.startMs - 200 && currentMs <= segment.endMs + 200

  const ipaQuery = useQuery({
    queryKey: ['ipa', segment.id],
    queryFn: () => wordsIpa({ data: { words: words.map((w) => w.w) } }),
    enabled: !!ipa,
    staleTime: Infinity,
  })
  const ipaWords = ipa ? ipaQuery.data : undefined

  const translation = useQuery({
    queryKey: ['translate', segment.id],
    queryFn: () => translateSentence({ data: { segmentId: segment.id } }),
    enabled: !!translate,
    staleTime: Infinity,
    retry: 1,
  })

  const [anchor, setAnchor] = useState<number | null>(null)
  const [sel, setSel] = useState<[number, number] | null>(null)
  const [lookup, setLookup] = useState<LookupTarget | null>(null)
  const closeLookup = useCallback(() => setLookup(null), [])

  // đổi câu → bỏ chọn
  useEffect(() => {
    setAnchor(null)
    setSel(null)
    setLookup(null)
  }, [segment.id])

  const rangeOf = (a: number, b: number) => {
    const from = Math.min(a, b)
    const to = Math.max(a, b)
    return {
      from,
      to,
      text: words
        .slice(from, to + 1)
        .map((w) => w.w)
        .join(' '),
      startMs: words[from].s,
      endMs: words[to].e,
    }
  }

  const onClick = (i: number, e: React.MouseEvent) => {
    const r = e.shiftKey && anchor !== null ? rangeOf(anchor, i) : rangeOf(i, i)
    if (!e.shiftKey || anchor === null) setAnchor(i)
    setSel([r.from, r.to])
    playerActions.playClip(r.startMs, r.endMs)
  }

  const onContextMenu = (i: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    // chuột phải vào trong cụm đang chọn → tra cả cụm, ngược lại tra riêng từ đó
    const inSel = sel && i >= sel[0] && i <= sel[1]
    const r = inSel ? rangeOf(sel[0], sel[1]) : rangeOf(i, i)
    if (!inSel) {
      setAnchor(i)
      setSel([i, i])
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setLookup({
      text: r.text,
      sentence: segment.text,
      startMs: r.startMs,
      endMs: r.endMs,
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left },
    })
  }

  return (
    <>
      <p
        className={cn(
          'flex flex-wrap gap-x-1 gap-y-1 text-2xl leading-snug font-medium transition-[filter]',
          ipaWords && 'gap-y-2',
          hidden && 'select-none blur-md hover:blur-none',
        )}
        title={hidden ? 'Di chuột để xem' : undefined}
      >
        {words.map((w, i) => {
          const state = !inRange
            ? 'idle'
            : currentMs >= w.e
              ? 'past'
              : currentMs >= w.s
                ? 'now'
                : 'future'
          const selected = sel !== null && i >= sel[0] && i <= sel[1]
          const tone = cn(
            state === 'past' && 'text-karaoke',
            state === 'now' &&
              'bg-karaoke text-primary-foreground hover:bg-karaoke',
            state === 'future' && 'text-muted-foreground',
          )
          return (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.shiftKey && e.preventDefault()}
              onClick={(e) => onClick(i, e)}
              onContextMenu={(e) => onContextMenu(i, e)}
              title="Click: nghe lại · Shift+click: chọn cụm · Chuột phải: tra từ"
              className={cn(
                'cursor-pointer rounded px-0.5 transition-colors duration-100 outline-none',
                'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                // có IPA: chỉ tô nền phần chữ, dòng IPA bên dưới vẫn đọc được
                ipaWords ? 'inline-flex flex-col items-center gap-0.5' : tone,
                selected &&
                  'ring-2 ring-primary/60 ring-offset-1 ring-offset-card',
              )}
            >
              {ipaWords ? (
                <>
                  <span
                    className={cn(
                      'rounded px-0.5 transition-colors duration-100',
                      tone,
                    )}
                  >
                    {w.w}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-xs font-normal transition-colors duration-100',
                      state === 'now'
                        ? 'text-karaoke'
                        : 'text-muted-foreground',
                    )}
                  >
                    {ipaWords[i] ? `/${ipaWords[i]}/` : ' '}
                  </span>
                </>
              ) : (
                w.w
              )}
            </button>
          )
        })}
      </p>
      {translate && (
        <p
          className={cn(
            'text-base text-muted-foreground transition-[filter]',
            hidden && 'select-none blur-sm hover:blur-none',
            translation.isError && 'text-destructive',
          )}
        >
          {translation.isPending
            ? 'Đang dịch…'
            : translation.isError
              ? translation.error.message
              : translation.data}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Click từ để nghe lại · <kbd className="font-mono">Shift</kbd>+click chọn
        cụm · chuột phải để tra từ điển
      </p>
      {ipa && ipaQuery.isError && (
        <p className="text-xs text-destructive">Không lấy được phiên âm IPA</p>
      )}
      {lookup && <WordLookupCard target={lookup} onClose={closeLookup} />}
    </>
  )
}

/** công tắc nhỏ đặt cạnh tiêu đề câu (IPA, Dịch…) */
export function OptionToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
    </div>
  )
}
