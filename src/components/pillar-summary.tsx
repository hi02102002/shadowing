import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, ChevronDown } from 'lucide-react'

import { PILLARS, pillarOfMistake } from '#/lib/shadowing-basics'
import type { PillarId } from '#/lib/shadowing-basics'
import { cn } from '#/lib/utils'

interface Pause {
  after: string
  ms: number
}

/**
 * Tóm tắt kết quả shadow theo 4 trụ cột: âm, trọng âm, ngữ điệu, nhịp điệu.
 * Số lỗi lấy từ nhận xét AI (cần AI); nhịp điệu luôn có tốc độ và chỗ ngắt dài vì đo được từ bản ghi.
 */
export function PillarSummary({
  mistakes,
  wpm,
  refWpm,
  pauses,
  focus,
  onFocus,
}: {
  /** undefined: chưa có nhận xét AI */
  mistakes?: Array<{ type: string }>
  wpm: number | null
  refWpm: number | null
  pauses: Pause[]
  /** trụ cột đang luyện (nếu có); bấm một ô để chuyển sang luyện trụ cột đó */
  focus?: PillarId
  onFocus?: (id: PillarId) => void
}) {
  const counts: Record<PillarId, number> = {
    sound: 0,
    stress: 0,
    intonation: 0,
    rhythm: 0,
  }
  for (const m of mistakes ?? []) {
    const pillar = pillarOfMistake(m.type)
    if (pillar) counts[pillar]++
  }

  const speed =
    wpm != null && refWpm
      ? wpm > refWpm * 1.2
        ? 'nhanh hơn bản gốc'
        : wpm < refWpm * 0.8
          ? 'chậm hơn bản gốc'
          : 'gần bằng bản gốc'
      : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          4 trụ cột shadowing
        </h4>
        <Link to="/ipa/shadowing" className="text-xs">
          Giải thích và luyện riêng →
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PILLARS.map((p) => {
          const n = counts[p.id]
          return (
            <li
              key={p.id}
              className="flex flex-col gap-0.5 rounded-lg border p-2.5 text-sm"
            >
              <span className="font-medium">
                {p.label}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  {p.vi}
                </span>
              </span>
              {mistakes === undefined ? (
                <span className="text-xs text-muted-foreground">
                  Cần AI phân tích
                </span>
              ) : n === 0 ? (
                <span className="flex items-center gap-1 text-xs text-ok">
                  <Check className="size-3" /> Chưa thấy lỗi
                </span>
              ) : (
                <span className={cn('text-xs font-medium text-miss')}>
                  {n} lỗi cần sửa
                </span>
              )}
              {onFocus && (
                <button
                  type="button"
                  onClick={() => onFocus(p.id)}
                  className="mt-0.5 self-start text-xs text-primary hover:underline"
                >
                  {focus === p.id ? 'Đang luyện phần này' : 'Luyện phần này'}
                </button>
              )}
              {p.id === 'rhythm' && (
                <span className="text-xs text-muted-foreground">
                  {speed ?? 'Chưa đo được tốc độ'}
                  {pauses.length > 0 &&
                    ` · ${pauses.length} chỗ ngắt dài (sau “${pauses[0].after}”${pauses.length > 1 ? '…' : ''})`}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** hướng dẫn gập được trên đầu trang shadow: 4 điều cần để ý khi bắt chước */
export function ShadowingGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
      >
        4 điều cần để ý khi shadowing
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t px-4 py-3">
          <ul className="grid gap-2 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <li key={p.id} className="text-sm">
                <span className="font-semibold">
                  {p.label}: <span className="text-primary">{p.vi}</span>
                </span>
                <p className="text-muted-foreground">{p.summary}</p>
              </li>
            ))}
          </ul>
          <Link to="/ipa/shadowing" className="self-start text-sm">
            Xem bài học và luyện từng phần →
          </Link>
        </div>
      )}
    </div>
  )
}
