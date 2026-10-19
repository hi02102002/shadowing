import { useSelector } from '@tanstack/react-store'
import { ChevronLeft, ChevronRight, Pause, Play, Repeat, RotateCcw } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import { RATES, playerActions, playerStore } from '#/lib/player-store'
import { cn } from '#/lib/utils'
import { formatTime } from '#/lib/format'

interface Props {
  index: number
  total: number
  startMs: number
  endMs: number
  onPrev: () => void
  onNext: () => void
}

export function SegmentControls({ index, total, startMs, endMs, onPrev, onNext }: Props) {
  const { playing, rate, loop, ready, plays } = useSelector(playerStore, (s) => ({
    playing: s.playing,
    rate: s.rate,
    loop: s.loop,
    ready: s.ready,
    plays: s.plays,
  }), { compare: shallowEqual })

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
      <IconButton label="Câu trước (←)" onClick={onPrev} disabled={index <= 0}>
        <ChevronLeft />
      </IconButton>

      <Button
        size="sm"
        onClick={() => (playing ? playerActions.pause() : playerActions.playRange(startMs, endMs))}
        disabled={!ready}
        className="min-w-28"
      >
        {playing ? <Pause /> : <Play />}
        {playing ? 'Tạm dừng' : 'Nghe câu'}
      </Button>

      <IconButton label="Phát lại từ đầu câu (R)" onClick={() => playerActions.playRange(startMs, endMs)} disabled={!ready}>
        <RotateCcw />
      </IconButton>

      <IconButton label="Câu sau (→)" onClick={onNext} disabled={index >= total - 1}>
        <ChevronRight />
      </IconButton>

      <div className="mx-1 h-6 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={loop ? 'default' : 'outline'}
            onClick={() => playerActions.setLoop(!loop)}
            aria-pressed={loop}
          >
            <Repeat />
            Lặp
          </Button>
        </TooltipTrigger>
        <TooltipContent>Lặp lại câu liên tục (L)</TooltipContent>
      </Tooltip>

      <div className="flex items-center rounded-lg border p-0.5" role="group" aria-label="Tốc độ phát">
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => playerActions.setRate(r)}
            className={cn(
              'rounded-md px-2 py-1 font-mono text-xs transition-colors',
              r === rate ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {r}×
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3 font-mono text-xs text-muted-foreground">
        {plays > 0 && <span title="Số lần đã nghe">🎧 {plays}</span>}
        <span>
          {formatTime(startMs)}–{formatTime(endMs)}
        </span>
        <span className="rounded-md bg-muted px-2 py-1 text-foreground">
          {index + 1}/{total}
        </span>
      </div>
    </div>
  )
}

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="outline" aria-label={label} className="size-8" {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T) {
  for (const k in a) if (a[k] !== b[k]) return false
  return true
}
