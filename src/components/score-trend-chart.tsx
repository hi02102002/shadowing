import { useEffect, useRef, useState } from 'react'

import type { ActivityStats } from '#/server/fns/stats'

type Week = ActivityStats['trend'][number]

const SERIES = [
  { key: 'dictation', label: 'Chép chính tả', color: 'var(--series-1)' },
  { key: 'pronunciation', label: 'Phát âm', color: 'var(--series-2)' },
] as const

const H = 220
const PAD = { top: 12, right: 140, bottom: 26, left: 34 }
const plotH = H - PAD.top - PAD.bottom

/** chiều rộng thật của khung để vẽ đúng tỉ lệ (không phóng to chữ / nét theo viewBox) */
function useWidth() {
  const [width, setWidth] = useState(640)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const fmtWeek = (week: string) => `${Number(week.slice(8, 10))}/${Number(week.slice(5, 7))}`

/**
 * Điểm trung bình mỗi tuần của chép chính tả và phát âm (cùng thang 0–100%, một trục).
 * Tuần không luyện thì đứt nét; rê chuột để xem cả hai điểm của tuần đó.
 */
export function ScoreTrendChart({ trend }: { trend: Week[] }) {
  const [at, setAt] = useState<number | null>(null)
  const [ref, W] = useWidth()
  const plotW = W - PAD.left - PAD.right
  const x = (i: number) => PAD.left + (trend.length === 1 ? plotW / 2 : (i / (trend.length - 1)) * plotW)
  const y = (v: number) => PAD.top + (1 - v / 100) * plotH

  /** các đoạn liền của một series (tuần không có dữ liệu cắt đường) */
  const segments = (key: (typeof SERIES)[number]['key']) => {
    const out: Array<Array<[number, number]>> = []
    let cur: Array<[number, number]> = []
    trend.forEach((w, i) => {
      const v = w[key]
      if (v) cur.push([x(i), y(v.avg)])
      else if (cur.length) {
        out.push(cur)
        cur = []
      }
    })
    if (cur.length) out.push(cur)
    return out
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - PAD.left) / plotW) * (trend.length - 1))
    setAt(Math.min(Math.max(i, 0), trend.length - 1))
  }

  const hovered = at == null ? null : trend[at]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div ref={ref} className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block touch-none select-none"
          role="img"
          aria-label="Điểm trung bình theo tuần"
          onPointerMove={onMove}
          onPointerLeave={() => setAt(null)}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {v}%
              </text>
            </g>
          ))}
          {trend.map((w, i) =>
            i % 3 === (trend.length - 1) % 3 ? (
              <text key={w.week} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {fmtWeek(w.week)}
              </text>
            ) : null,
          )}
          {at != null && (
            <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-muted-foreground/50" strokeWidth={1} />
          )}
          {SERIES.map((s) => {
            const segs = segments(s.key)
            const last = segs.at(-1)?.at(-1)
            const lastIdx = trend.map((w) => !!w[s.key]).lastIndexOf(true)
            return (
              <g key={s.key}>
                {segs.map((seg, k) => (
                  <polyline
                    key={k}
                    points={seg.map((p) => p.join(',')).join(' ')}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}
                {segs.flat().map(([px, py], k) => (
                  <circle key={k} cx={px} cy={py} r={4} fill={s.color} className="stroke-card" strokeWidth={2} />
                ))}
                {/* nhãn trực tiếp ở điểm cuối: chữ dùng màu chữ, chấm màu bên cạnh mang nhận diện */}
                {last && lastIdx >= 0 && (
                  <text x={last[0] + 8} y={last[1] + 3} className="fill-foreground text-[11px] font-medium">
                    {trend[lastIdx][s.key]!.avg}% <tspan className="fill-muted-foreground font-normal">{s.label}</tspan>
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {hovered && at != null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
            style={{
              left: `${(x(at) / W) * 100}%`,
              transform: at > trend.length / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
            }}
          >
            <div className="mb-1 text-muted-foreground">Tuần từ {fmtWeek(hovered.week)}</div>
            {SERIES.map((s) => {
              const v = hovered[s.key]
              return (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                  <span className="font-semibold tabular-nums">{v ? `${v.avg}%` : '–'}</span>
                  <span className="text-muted-foreground">
                    {s.label}
                    {v && ` · ${v.n} lượt`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
