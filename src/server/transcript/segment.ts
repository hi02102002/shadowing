import type { TimedWord } from './json3.ts'

export interface SentenceSegment {
  startMs: number
  endMs: number
  text: string
  words: TimedWord[]
}

export interface SegmentOptions {
  /** câu ngắn hơn thế này sẽ được gộp với câu sau */
  minMs?: number
  /** câu dài hơn thế này sẽ bị cắt tại chỗ ngắt tự nhiên nhất */
  maxMs?: number
  /** khoảng lặng giữa hai từ coi như ranh giới câu (dùng khi không có dấu câu) */
  pauseMs?: number
  /** số từ tối đa mỗi câu */
  maxWords?: number
}

const END_PUNCT = /[.!?…]["')\]]*$/
const SOFT_PUNCT = /[,;:—–-]["')\]]*$/
const CONJUNCTIONS = new Set(['and', 'but', 'so', 'because', 'or', 'which', 'that', 'when', 'if', 'then'])

/**
 * Gộp danh sách từ có timing thành các câu luyện tập.
 * Ưu tiên ranh giới: dấu kết câu > khoảng lặng dài > dấu phẩy/liên từ khi câu quá dài.
 */
export function segmentWords(words: TimedWord[], opts: SegmentOptions = {}): SentenceSegment[] {
  const { minMs = 1500, maxMs = 12000, pauseMs = 900, maxWords = 28 } = opts
  const out: SentenceSegment[] = []
  let buf: TimedWord[] = []

  const push = (ws: TimedWord[]) => {
    if (!ws.length) return
    out.push({
      startMs: ws[0].s,
      endMs: ws[ws.length - 1].e,
      text: ws.map((w) => w.w).join(' '),
      words: ws,
    })
  }

  /** cắt buf tại vị trí ngắt mềm tốt nhất ở nửa sau, trả về phần còn lại */
  const splitLong = (ws: TimedWord[]): TimedWord[] => {
    let best = -1
    let bestScore = -1
    for (let i = Math.floor(ws.length * 0.35); i < ws.length - 2; i++) {
      const gap = ws[i + 1].s - ws[i].e
      let score = gap
      if (SOFT_PUNCT.test(ws[i].w)) score += 2000
      if (CONJUNCTIONS.has(ws[i + 1].w.toLowerCase())) score += 800
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }
    if (best < 0) best = Math.floor(ws.length / 2) - 1
    push(ws.slice(0, best + 1))
    return ws.slice(best + 1)
  }

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const next = i + 1 < words.length ? words[i + 1] : undefined
    buf.push(w)

    const dur = w.e - buf[0].s
    const gap = next ? next.s - w.e : Infinity
    const isEnd = END_PUNCT.test(w.w)
    const isPause = gap >= pauseMs

    if ((isEnd || isPause || !next) && (dur >= minMs || !next || gap > 2500)) {
      while (buf.length > maxWords || (buf.length > 6 && buf[buf.length - 1].e - buf[0].s > maxMs)) {
        buf = splitLong(buf)
      }
      push(buf)
      buf = []
    } else if (buf.length > maxWords * 1.5 || dur > maxMs * 1.5) {
      buf = splitLong(buf)
    }
  }
  push(buf)

  return out.map(capitalize)
}

function capitalize(seg: SentenceSegment): SentenceSegment {
  const text = seg.text.replace(/\s+([,.!?;:])/g, '$1').trim()
  return { ...seg, text: text.charAt(0).toUpperCase() + text.slice(1) }
}
