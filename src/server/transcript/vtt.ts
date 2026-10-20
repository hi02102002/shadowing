import type { Json3 } from './json3.ts'

const TIME_RE = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})/

function toMs(t: string) {
  const m = TIME_RE.exec(t)
  if (!m) return null
  const [, h = '0', min, s, ms] = m
  return ((Number(h) * 60 + Number(min)) * 60 + Number(s)) * 1000 + Number(ms)
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '')

/**
 * Chuyển WebVTT sang dạng json3 (mỗi cue là một event, không có timing từng từ)
 * để dùng chung parseJson3 → timing từng từ được chia theo số ký tự.
 */
export function vttToJson3(vtt: string): Json3 {
  const events: NonNullable<Json3['events']> = []
  for (const block of vtt.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n')
    const timeIdx = lines.findIndex((l) => l.includes('-->'))
    if (timeIdx < 0) continue
    const [from, to] = lines[timeIdx].split('-->')
    const start = toMs(from)
    const end = toMs(to)
    if (start === null || end === null || end <= start) continue
    const text = stripTags(lines.slice(timeIdx + 1).join(' ')).trim()
    if (!text) continue
    events.push({ tStartMs: start, dDurationMs: end - start, segs: [{ utf8: text }] })
  }
  return { events }
}
