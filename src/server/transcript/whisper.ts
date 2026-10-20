/** Chuẩn hoá kết quả Whisper (whisper.cpp hoặc API STT) về danh sách từ có timing, dùng chung với phụ đề YouTube */
import type { SttResult } from '../stt.ts'
import type { WhisperCppJson } from '../whisper-local.ts'
import { parseJson3 } from './json3.ts'
import type { TimedWord } from './json3.ts'

/** Chú thích kiểu [BLANK_AUDIO], (music), ♪ */
const isNoise = (w: string) => /^[[(].*[\])]$/.test(w) || /^[♪♫]+$/.test(w)
const isPunct = (w: string) => !/[\p{L}\p{N}]/u.test(w)

/**
 * Whisper cho từ trước khoảng lặng kéo dài tới tận từ sau (timestamp liền nhau)
 * → cắt đuôi để karaoke không đứng mãi một từ và câu dừng đúng lúc người nói ngừng.
 */
function trimLongWord(word: TimedWord): TimedWord {
  const maxMs = Math.max(500, word.w.length * 100)
  return word.e - word.s > 1000 && word.e - word.s > maxMs ? { ...word, e: word.s + maxMs } : word
}

function clean(words: TimedWord[]): TimedWord[] {
  const out: TimedWord[] = []
  for (const word of words) {
    const w = word.w.trim()
    if (!w || isNoise(w)) continue
    const prev = out.at(-1)
    // dấu câu đứng riêng (" .", " -") → gắn vào từ trước
    if (isPunct(w) && prev) {
      prev.w += w
      continue
    }
    out.push({ w, s: word.s, e: word.e })
  }
  return out.map(trimLongWord)
}

/** Đầu ra JSON của `whisper-cli -ml 1 -sow -oj`: mỗi phần tử là một từ, offset tính bằng ms */
export function fromWhisperCppJson(json: WhisperCppJson, offsetMs = 0): TimedWord[] {
  return clean(
    (json.transcription ?? []).map((t) => ({
      w: t.text,
      s: t.offsets.from + offsetMs,
      e: t.offsets.to + offsetMs,
    })),
  )
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')

/**
 * Kết quả API STT (`verbose_json`), có thể gồm nhiều đoạn audio nối nhau.
 * - Có timestamp từng từ: `words` không có dấu câu → lấy dấu câu từ `segments[].text` (cần để tách câu).
 * - Không có (vd. gpt-4o-transcribe): coi mỗi segment như một dòng phụ đề, chia timing theo số ký tự.
 */
export function fromSttResults(chunks: Array<{ offsetMs: number; result: SttResult }>): TimedWord[] {
  if (chunks.some((c) => c.result.words.length)) {
    const words: TimedWord[] = []
    for (const { offsetMs, result } of chunks) {
      const tokens = result.segments.flatMap((s) => s.text.split(/\s+/)).filter(Boolean)
      let cursor = 0
      for (const sw of result.words) {
        let w = sw.word
        // tìm từ tương ứng trong vài token phía trước (Whisper đôi khi tách/gộp khác nhau giữa hai danh sách)
        for (let k = cursor; k < Math.min(tokens.length, cursor + 4); k++) {
          if (norm(tokens[k]) === norm(sw.word)) {
            w = tokens[k]
            cursor = k + 1
            break
          }
        }
        words.push({ w, s: Math.round(sw.start * 1000) + offsetMs, e: Math.round(sw.end * 1000) + offsetMs })
      }
    }
    return clean(words)
  }

  const events = chunks.flatMap(({ offsetMs, result }) =>
    result.segments.map((s) => ({
      tStartMs: Math.round(s.start * 1000) + offsetMs,
      dDurationMs: Math.round((s.end - s.start) * 1000),
      segs: [{ utf8: s.text.trim() }],
    })),
  )
  return clean(parseJson3({ events }).words)
}
