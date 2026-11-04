import { useState } from 'react'
import { Timer } from 'lucide-react'

import { cn } from '#/lib/utils'

/** 0 → "Không", 45 → "45 giây", 90 → "1:30", 120 → "2 phút" */
export function formatSeconds(seconds: number) {
  if (seconds === 0) return 'Không'
  if (seconds < 60) return `${seconds} giây`
  if (seconds % 60 === 0) return `${seconds / 60} phút`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Hàng nút chọn nhanh thời gian; giá trị lưu trong Cài đặt nên dùng lại cho lần sau */
export function TimeChoice({
  label,
  value,
  choices,
  onChange,
  disabled,
  min = 0,
  max,
}: {
  label: string
  value: number
  choices: readonly number[]
  onChange: (seconds: number) => void
  disabled?: boolean
  /** giới hạn khi tự nhập (giây) */
  min?: number
  max: number
}) {
  const [custom, setCustom] = useState<string | null>(null)
  const commit = () => {
    if (custom === null) return
    const n = Math.round(Number(custom))
    if (Number.isFinite(n) && custom.trim() !== '')
      onChange(Math.min(max, Math.max(min, n)))
    setCustom(null)
  }
  // giá trị đang lưu không nằm trong danh sách (vd. sửa tay) vẫn hiện để không bị mất
  const options = choices.includes(value)
    ? choices
    : [...choices, value].sort((a, b) => a - b)
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 text-sm"
      role="group"
      aria-label={label}
    >
      <span className="mr-1 flex items-center gap-1 font-medium">
        <Timer className="size-4 text-muted-foreground" /> {label}
      </span>
      {options.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 transition-colors disabled:opacity-50',
            value === s
              ? 'border-primary bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {formatSeconds(s)}
        </button>
      ))}
      {custom === null ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCustom(String(value))}
          className="rounded-full border border-dashed px-2.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          Khác…
        </button>
      ) : (
        <label className="flex items-center gap-1 text-muted-foreground">
          <input
            type="number"
            autoFocus
            min={min}
            max={max}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') setCustom(null)
            }}
            className="h-7 w-20 rounded-md border bg-background px-2 text-foreground"
            aria-label={`${label} (giây, ${min}–${max})`}
          />
          giây (tối đa {formatSeconds(max)})
        </label>
      )}
    </div>
  )
}
