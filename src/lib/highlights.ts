/** Bôi màu trong bài đọc (như công cụ highlight của máy thi IELTS): các vùng [start, end) trong từng đoạn */
import type { ReadingHighlight } from '#/db/schema.ts'

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'pink', 'blue'] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export const HIGHLIGHT_CLASS: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-200 dark:bg-yellow-400/35',
  green: 'bg-green-200 dark:bg-green-400/30',
  pink: 'bg-pink-200 dark:bg-pink-400/30',
  blue: 'bg-sky-200 dark:bg-sky-400/30',
}

/** bỏ phần [start, end) của đoạn p khỏi các vùng đã tô (vùng bị cắt giữa thì tách đôi) */
export function eraseRange(list: ReadingHighlight[], p: number, start: number, end: number): ReadingHighlight[] {
  return list.flatMap((h) => {
    if (h.p !== p || h.end <= start || h.start >= end) return [h]
    return [
      ...(h.start < start ? [{ ...h, end: start }] : []),
      ...(h.end > end ? [{ ...h, start: end }] : []),
    ]
  })
}

/** tô vùng mới: đè lên phần trùng của vùng cũ, gộp với vùng cùng màu liền kề */
export function addHighlight(list: ReadingHighlight[], h: ReadingHighlight): ReadingHighlight[] {
  if (h.end <= h.start) return list
  const rest = eraseRange(list, h.p, h.start, h.end)
  let merged = h
  const others = rest.filter((o) => {
    const touch = o.p === h.p && o.color === h.color && (o.end === merged.start || o.start === merged.end)
    if (touch) merged = { ...merged, start: Math.min(o.start, merged.start), end: Math.max(o.end, merged.end) }
    return !touch
  })
  return [...others, merged].sort((a, b) => a.p - b.p || a.start - b.start)
}

export interface TextPiece {
  start: number
  end: number
  /** chỉ số vùng tô trong danh sách (để bấm vào sửa / xoá) */
  highlight: number | null
  color: HighlightColor | null
  /** nằm trong đoạn đang được chỉ ra (căn cứ của câu hỏi, câu chứa từ) */
  marked: boolean
}

/** chia đoạn văn thành các mảnh theo ranh giới vùng tô và vùng đang chỉ ra */
export function splitPieces(length: number, p: number, list: ReadingHighlight[], mark: [number, number] | null): TextPiece[] {
  const own = list.map((h, i) => ({ ...h, i })).filter((h) => h.p === p)
  const cuts = new Set([0, length, ...own.flatMap((h) => [h.start, h.end]), ...(mark ?? [])])
  const points = [...cuts].filter((c) => c >= 0 && c <= length).sort((a, b) => a - b)
  return points.slice(0, -1).map((start, k) => {
    const end = points[k + 1]
    const h = own.find((x) => x.start <= start && x.end >= end)
    return {
      start,
      end,
      highlight: h ? h.i : null,
      color: h ? h.color : null,
      marked: !!mark && mark[0] <= start && mark[1] >= end,
    }
  })
}
