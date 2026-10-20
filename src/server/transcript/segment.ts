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
/** phụ đề có dấu câu thì khoảng lặng ngắn hơn thế này chỉ là ngừng lấy hơi giữa câu, không phải hết câu */
const PUNCTUATED_PAUSE_MS = 2500

/** phụ đề có dấu câu (thủ công, Whisper, auto-caption kiểu mới) → tin dấu câu hơn khoảng lặng */
const isPunctuated = (words: TimedWord[]) =>
  words.filter((w) => END_PUNCT.test(w.w)).length >= Math.max(2, words.length * 0.02)

/** dấu phẩy trong một chuỗi liệt kê ("fluent, confident, and expressive") → không nên cắt ở đó */
const COMMA = /,["')\]]*$/
const inList = (ws: TimedWord[], i: number) =>
  COMMA.test(ws[i].w) &&
  (ws.slice(Math.max(0, i - 4), i).some((w) => COMMA.test(w.w)) ||
    ws.slice(i + 1, i + 4).some((w) => COMMA.test(w.w)))
/** mỗi phần sau khi cắt câu dài phải có ít nhất chừng này từ, tránh mẩu cụt kiểu "and expressive." */
const MIN_PART_WORDS = 5

/**
 * Gộp danh sách từ có timing thành các câu luyện tập.
 * Ưu tiên ranh giới: dấu kết câu > khoảng lặng dài > dấu phẩy/liên từ khi câu quá dài.
 */
export function segmentWords(words: TimedWord[], opts: SegmentOptions = {}): SentenceSegment[] {
  const { minMs = 1500, maxMs = 16000, pauseMs = 900, maxWords = 32 } = opts
  const out: SentenceSegment[] = []
  const punctuated = isPunctuated(words)
  const pauseLimit = punctuated ? Math.max(pauseMs, PUNCTUATED_PAUSE_MS) : pauseMs
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
    const from = Math.max(MIN_PART_WORDS - 1, Math.floor(ws.length * 0.35))
    for (let i = from; i < ws.length - MIN_PART_WORDS; i++) {
      const gap = ws[i + 1].s - ws[i].e
      let score = gap
      if (!inList(ws, i)) {
        if (SOFT_PUNCT.test(ws[i].w)) score += 2000
        if (CONJUNCTIONS.has(ws[i + 1].w.toLowerCase())) score += 800
      }
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
    const isPause = gap >= pauseLimit

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

  // phụ đề có dấu câu: chỉ viết hoa đầu câu thật, đoạn nối tiếp câu trước (bị cắt vì quá dài) giữ chữ thường
  return out.map((seg, i) => tidy(seg, !punctuated || i === 0 || END_PUNCT.test(out[i - 1].text)))
}

function tidy(seg: SentenceSegment, sentenceStart: boolean): SentenceSegment {
  const text = seg.text.replace(/\s+([,.!?;:])/g, '$1').trim()
  return { ...seg, text: sentenceStart ? text.charAt(0).toUpperCase() + text.slice(1) : text }
}

/** lấn sang khoảng lặng trước câu (giữ phụ âm đầu) */
const LEAD_INTO_SILENCE_MS = 150
/** lấn sang khoảng lặng sau câu: timing phụ đề hay kết thúc sớm, cắt mất phụ âm cuối kéo dài (/n/ trong "town") */
const TAIL_INTO_SILENCE_MS = 400

/**
 * Khoảng phát của từng câu: mở rộng vào khoảng lặng hai bên nhưng không chạm sang câu kề bên.
 * Câu nối liền nhau (không có khoảng lặng) giữ nguyên.
 */
export function playbackBounds<TSeg extends { startMs: number; endMs: number }>(segs: TSeg[]): TSeg[] {
  return segs.map((seg, i) => {
    const prevEnd = i > 0 ? segs[i - 1].endMs : 0
    const nextStart = i + 1 < segs.length ? segs[i + 1].startMs : Infinity
    return {
      ...seg,
      startMs: Math.max(prevEnd, Math.min(seg.startMs, seg.startMs - LEAD_INTO_SILENCE_MS), 0),
      endMs: Math.max(seg.endMs, Math.min(nextStart, seg.endMs + TAIL_INTO_SILENCE_MS)),
    }
  })
}
