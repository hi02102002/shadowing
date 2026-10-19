/**
 * Parse phụ đề YouTube định dạng json3 thành danh sách từ có timing (ms).
 *
 * - Phụ đề thủ công: mỗi event là một dòng, không có timing từng từ →
 *   chia đều thời lượng event cho các từ.
 * - Auto-caption: mỗi seg có `tOffsetMs` → timing từng từ chính xác.
 *   Các event `aAppend` chỉ chứa "\n" để cuộn dòng, bỏ qua.
 */

export interface TimedWord {
  w: string
  s: number
  e: number
}

interface Json3Seg {
  utf8?: string
  tOffsetMs?: number
}
interface Json3Event {
  tStartMs?: number
  dDurationMs?: number
  aAppend?: number
  segs?: Json3Seg[]
}
export interface Json3 {
  events?: Json3Event[]
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

/** Bỏ chú thích kiểu [Music], (Applause), ♪ */
const isNoise = (w: string) => /^[[(].*[\])]$/.test(w) || /^[♪♫]+$/.test(w)

export function parseJson3(data: Json3): { words: TimedWord[]; hasWordTiming: boolean } {
  const events = (data.events ?? []).filter(
    (e) => e.segs && !e.aAppend && e.tStartMs !== undefined,
  )
  const hasWordTiming = events.some((e) => e.segs!.some((s) => s.tOffsetMs !== undefined))
  const words: TimedWord[] = []

  for (let k = 0; k < events.length; k++) {
    const ev = events[k]
    const start = ev.tStartMs!
    const dur = ev.dDurationMs ?? 0
    // auto-caption: event kế tiếp thường chồng lên event hiện tại, nên cắt end theo event sau
    const nextStart = events[k + 1]?.tStartMs
    const end = nextStart !== undefined && nextStart < start + dur ? nextStart : start + dur

    if (hasWordTiming) {
      const segs = ev.segs!.filter((s) => s.utf8 && s.utf8.trim())
      segs.forEach((seg, i) => {
        const s = start + (seg.tOffsetMs ?? 0)
        const nextOffset = segs[i + 1]?.tOffsetMs
        const e = nextOffset !== undefined ? start + nextOffset : end
        for (const w of decode(seg.utf8!).trim().split(/\s+/)) {
          if (w && !isNoise(w)) words.push({ w, s, e: Math.max(e, s + 1) })
        }
      })
    } else {
      const text = decode(ev.segs!.map((s) => s.utf8 ?? '').join(''))
        .replace(/\s+/g, ' ')
        .trim()
      const parts = text.split(' ').filter((w) => w && !isNoise(w))
      if (!parts.length) continue
      // chia thời lượng theo số ký tự để từ dài có nhiều thời gian hơn
      const totalChars = parts.reduce((n, w) => n + w.length + 1, 0)
      let t = start
      for (const w of parts) {
        const d = ((w.length + 1) / totalChars) * (end - start)
        words.push({ w, s: Math.round(t), e: Math.round(t + d) })
        t += d
      }
    }
  }

  return { words, hasWordTiming }
}
