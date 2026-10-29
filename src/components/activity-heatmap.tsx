import { useState } from 'react'

import { cn } from '#/lib/utils'
import type { ActivityStats } from '#/server/fns/stats'

type Day = ActivityStats['days'][number]

const KINDS = [
  { key: 'dictation', label: 'Chép chính tả' },
  { key: 'pronunciation', label: 'Luyện nói' },
  { key: 'review', label: 'Ôn thẻ' },
  { key: 'grammar', label: 'Ngữ pháp' },
] as const

const WEEKDAYS = ['T2', '', 'T4', '', 'T6', '', '']

/** mức màu theo phần mục tiêu ngày đã đạt: 0 = không học, 4 = đạt mục tiêu */
export function heatLevel(total: number, goal: number) {
  if (!total) return 0
  const r = total / goal
  return r >= 1 ? 4 : r >= 2 / 3 ? 3 : r >= 1 / 3 ? 2 : 1
}

const fmtDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })

/**
 * Lịch hoạt động kiểu GitHub: mỗi cột một tuần (thứ Hai → Chủ nhật), màu đậm dần theo số lượt luyện so với mục tiêu.
 * Rê chuột vào ô để xem chi tiết từng loại; bảng 30 ngày gần nhất bên dưới cho bàn phím / trình đọc màn hình.
 */
export function ActivityHeatmap({ days, goal }: { days: Day[]; goal: number }) {
  const [hover, setHover] = useState<{ day: Day; x: number; y: number } | null>(null)
  const weeks: Day[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  // tên tháng ở cột có ngày mùng 1 (hoặc tuần đầu tiên)
  const monthOf = (w: Day[], i: number) => {
    const first = w.find((d) => d.day.endsWith('-01'))
    if (first) return `Th${Number(first.day.slice(5, 7))}`
    return i === 0 ? `Th${Number(w[0].day.slice(5, 7))}` : ''
  }

  return (
    <div className="flex flex-col gap-3">
      {/* giãn hết chiều ngang khung; màn hẹp thì ô tối thiểu 8px và cuộn ngang */}
      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-[560px] gap-[3px]"
          // cột nhãn thứ cùng cỡ với cột ô để các hàng thẳng nhau
          style={{ gridTemplateColumns: `repeat(${weeks.length + 1}, minmax(8px, 1fr))` }}
        >
          <div className="flex flex-col gap-[3px] text-[10px] text-muted-foreground">
            <span className="h-3.5" />
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="flex aspect-square items-center leading-none">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((w, i) => (
            <div key={w[0].day} className="flex min-w-0 flex-col gap-[3px]">
              <span className="h-3.5 overflow-visible text-[10px] leading-3.5 whitespace-nowrap text-muted-foreground">
                {monthOf(w, i)}
              </span>
              {w.map((d) => (
                <div
                  key={d.day}
                  className={cn(
                    `heat-${heatLevel(d.total, goal)}`,
                    'aspect-square w-full rounded-[3px] transition-[outline] hover:outline-2 hover:outline-foreground/60',
                  )}
                  onPointerEnter={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setHover({ day: d, x: r.left + r.width / 2, y: r.top })
                  }}
                  onPointerLeave={() => setHover(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Mỗi ô là một ngày; đậm nhất là ngày đạt mục tiêu {goal} lượt.</span>
        <span className="flex items-center gap-1">
          Ít
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={cn(`heat-${l}`, 'size-3 rounded-[3px]')} />
          ))}
          Nhiều
        </span>
      </div>

      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <div className="text-sm font-semibold">{hover.day.total} lượt</div>
          <div className="text-muted-foreground first-letter:uppercase">{fmtDay(hover.day.day)}</div>
          {hover.day.total > 0 && (
            <ul className="mt-1">
              {KINDS.filter((k) => hover.day[k.key] > 0).map((k) => (
                <li key={k.key}>
                  <span className="font-medium">{hover.day[k.key]}</span>{' '}
                  <span className="text-muted-foreground">{k.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Xem dạng bảng (30 ngày gần nhất)
        </summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Ngày</th>
              {KINDS.map((k) => (
                <th key={k.key} className="py-1 text-right font-medium">
                  {k.label}
                </th>
              ))}
              <th className="py-1 text-right font-medium">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {days
              .slice(-30)
              .reverse()
              .map((d) => (
                <tr key={d.day} className="border-t">
                  <td className="py-1">{d.day.split('-').reverse().join('/')}</td>
                  {KINDS.map((k) => (
                    <td key={k.key} className="py-1 text-right tabular-nums">
                      {d[k.key] || '–'}
                    </td>
                  ))}
                  <td className="py-1 text-right font-medium tabular-nums">{d.total}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
