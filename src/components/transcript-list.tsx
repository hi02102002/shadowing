import { useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSelector } from '@tanstack/react-store'

import { findSegmentIndex, playerStore } from '#/lib/player-store'
import { formatTime, scoreTone } from '#/lib/format'
import { cn } from '#/lib/utils'
import type { SegmentView } from '#/server/fns/videos'

interface Props {
  segments: SegmentView[]
  /** câu đang luyện (chế độ practice) — nếu không truyền thì theo thời gian phát */
  selectedIdx?: number
  onSelect: (idx: number) => void
  /** ẩn chữ để luyện nghe chép (chỉ hiện câu đã làm) */
  hideText?: boolean
  className?: string
}

export function TranscriptList({ segments, selectedIdx, onSelect, hideText, className }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const currentMs = useSelector(playerStore, (s) => s.currentMs)
  const playingIdx = useMemo(() => findSegmentIndex(segments, currentMs), [segments, currentMs])
  const activeIdx = selectedIdx ?? playingIdx

  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  })

  // cuộn câu đang active vào giữa khi nó đổi
  useEffect(() => {
    if (activeIdx >= 0) virtualizer.scrollToIndex(activeIdx, { align: 'center', behavior: 'smooth' })
  }, [activeIdx, virtualizer])

  return (
    <div ref={parentRef} className={cn('overflow-y-auto overscroll-contain', className)}>
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const seg = segments[item.index]
          const active = item.index === activeIdx
          const playingHere = item.index === playingIdx
          const done = seg.dictationBest != null || seg.pronunciationBest != null
          const masked = hideText && seg.dictationBest == null && !active
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full px-1 py-0.5"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <button
                type="button"
                onClick={() => onSelect(item.index)}
                className={cn(
                  'group flex w-full gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 w-10 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground',
                    playingHere && 'text-primary',
                  )}
                >
                  {formatTime(seg.startMs)}
                </span>
                <span className={cn('flex-1 leading-relaxed', masked && 'select-none blur-[5px]')}>
                  {seg.text}
                </span>
                {done && (
                  <span className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
                    <ScoreDot label="Chép" score={seg.dictationBest} />
                    <ScoreDot label="Nói" score={seg.pronunciationBest} />
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScoreDot({ label, score }: { label: string; score: number | null }) {
  if (score == null) return null
  const tone = scoreTone(score)
  return (
    <span
      title={`${label}: ${Math.round(score)}%`}
      className={cn(
        'rounded px-1 font-mono text-[10px] leading-4',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'miss' && 'bg-miss-soft text-miss',
        tone === 'bad' && 'bg-bad-soft text-bad',
      )}
    >
      {label[0]}
      {Math.round(score)}
    </span>
  )
}
