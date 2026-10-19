import { scoreTone } from '#/lib/format'
import { cn } from '#/lib/utils'

export function ScoreRing({ value, label, size = 72 }: { value: number; label: string; size?: number }) {
  const tone = scoreTone(value)
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const color = tone === 'ok' ? 'var(--ok)' : tone === 'miss' ? 'var(--miss)' : 'var(--bad)'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={6} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.min(100, Math.max(0, value)) / 100)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className={cn('absolute inset-0 grid place-items-center font-mono text-lg font-semibold')}>
          {Math.round(value)}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
