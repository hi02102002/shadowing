import { Loader2, Mic, Square } from 'lucide-react'

import { cn } from '#/lib/utils'

interface Props {
  recording: boolean
  busy?: boolean
  level: number
  elapsedMs: number
  onStart: () => void
  onStop: () => void
  disabled?: boolean
  label?: string
}

/** Nút ghi âm tròn lớn với vòng meter âm lượng */
export function RecordButton({ recording, busy, level, elapsedMs, onStart, onStop, disabled, label }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={recording ? onStop : onStart}
        disabled={disabled || busy}
        aria-label={recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
        className={cn(
          'relative grid size-16 place-items-center rounded-full text-white shadow-lg transition-all disabled:opacity-50',
          recording ? 'rec-pulse bg-rec' : 'bg-primary hover:scale-105',
        )}
        style={recording ? { boxShadow: `0 0 0 ${4 + level * 14}px color-mix(in oklab, var(--rec) 25%, transparent)` } : undefined}
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin" />
        ) : recording ? (
          <Square className="size-5 fill-current" />
        ) : (
          <Mic className="size-6" />
        )}
      </button>
      <span className="font-mono text-xs text-muted-foreground">
        {busy ? 'Đang chấm…' : recording ? `${(elapsedMs / 1000).toFixed(1)}s · bấm để dừng` : (label ?? 'Bấm để nói (M)')}
      </span>
    </div>
  )
}
