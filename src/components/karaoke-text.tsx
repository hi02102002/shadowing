import { useCallback, useEffect, useState } from 'react'
import { useSelector } from '@tanstack/react-store'

import { WordLookupCard } from '#/components/word-lookup-card'
import type { LookupTarget } from '#/components/word-lookup-card'
import { playerActions, playerStore } from '#/lib/player-store'
import { cn } from '#/lib/utils'
import type { SegmentView } from '#/server/fns/videos'

/**
 * Câu luyện tập với từ đang nói được tô sáng theo thời gian phát (timing từ phụ đề:
 * auto-caption chính xác, phụ đề thủ công ước lượng).
 *
 * - Click một từ: nghe lại đúng từ đó trong video
 * - Shift+click: chọn cụm từ từ lần click trước đến từ này rồi nghe cả cụm
 * - Chuột phải (hoặc phím Menu / Shift+F10): tra từ điển theo ngữ cảnh câu
 */
export function KaraokeText({
  segment,
  hidden,
}: {
  segment: SegmentView
  hidden?: boolean
}) {
  const currentMs = useSelector(playerStore, (s) => s.currentMs)
  const words = segment.words.length
    ? segment.words
    : segment.text
        .split(' ')
        .map((w) => ({ w, s: segment.startMs, e: segment.endMs }))
  const inRange =
    currentMs >= segment.startMs - 200 && currentMs <= segment.endMs + 200

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
                state === 'past' && 'text-karaoke',
                state === 'now' &&
                  'bg-karaoke text-primary-foreground hover:bg-karaoke',
                state === 'future' && 'text-muted-foreground',
                selected &&
                  'ring-2 ring-primary/60 ring-offset-1 ring-offset-card',
              )}
            >
              {w.w}
            </button>
          )
        })}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Click từ để nghe lại · <kbd className="font-mono">Shift</kbd>+click chọn
        cụm · chuột phải để tra từ điển
      </p>
      {lookup && <WordLookupCard target={lookup} onClose={closeLookup} />}
    </>
  )
}
