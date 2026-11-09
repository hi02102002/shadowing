import type { TimedWord } from '#/server/transcript/json3.ts'

export interface EditableSegment {
  id: number
  idx: number
  startMs: number
  endMs: number
  text: string
  wordsJson: string
}

export function wordsOf(segment: EditableSegment): TimedWord[] {
  return JSON.parse(segment.wordsJson) as TimedWord[]
}

export function textOfWords(words: TimedWord[]): string {
  return words
    .map((word) => word.w)
    .join(' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
}

export function mergeSegments(
  rows: EditableSegment[],
): Omit<EditableSegment, 'id' | 'idx'> {
  if (rows.length < 2) throw new Error('Chọn ít nhất hai đoạn liền nhau')
  return {
    startMs: rows[0].startMs,
    endMs: rows.at(-1)!.endMs,
    text: rows
      .map((row) => row.text)
      .join(' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .trim(),
    wordsJson: JSON.stringify(rows.flatMap(wordsOf)),
  }
}

export function splitSegment(
  row: EditableSegment,
  wordIndex: number,
): [Omit<EditableSegment, 'id' | 'idx'>, Omit<EditableSegment, 'id' | 'idx'>] {
  const words = wordsOf(row)
  if (
    !Number.isInteger(wordIndex) ||
    wordIndex < 1 ||
    wordIndex >= words.length
  )
    throw new Error('Chọn vị trí giữa hai từ để tách')
  const left = words.slice(0, wordIndex)
  const right = words.slice(wordIndex)
  if (left.at(-1)!.e <= left[0].s || right.at(-1)!.e <= right[0].s)
    throw new Error('Mốc thời gian của đoạn không hợp lệ')
  return [
    {
      startMs: left[0].s,
      endMs: left.at(-1)!.e,
      text: textOfWords(left),
      wordsJson: JSON.stringify(left),
    },
    {
      startMs: right[0].s,
      endMs: right.at(-1)!.e,
      text: textOfWords(right),
      wordsJson: JSON.stringify(right),
    },
  ]
}
