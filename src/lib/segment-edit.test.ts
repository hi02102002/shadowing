import { describe, expect, it } from 'vitest'
import { mergeSegments, splitSegment } from './segment-edit.ts'

const first = {
  id: 1,
  idx: 0,
  startMs: 1000,
  endMs: 2300,
  text: 'I like fresh fish.',
  wordsJson: JSON.stringify([
    { w: 'I', s: 1000, e: 1200 },
    { w: 'like', s: 1200, e: 1450 },
    { w: 'fresh', s: 1450, e: 1850 },
    { w: 'fish.', s: 1850, e: 2300 },
  ]),
}

describe('segment editing', () => {
  it('ghép toàn bộ thời gian, chữ và timing của từng từ', () => {
    const merged = mergeSegments([
      first,
      {
        id: 2,
        idx: 1,
        startMs: 2500,
        endMs: 3000,
        text: 'And salad.',
        wordsJson: JSON.stringify([
          { w: 'And', s: 2500, e: 2700 },
          { w: 'salad.', s: 2700, e: 3000 },
        ]),
      },
    ])
    expect(merged).toMatchObject({
      startMs: 1000,
      endMs: 3000,
      text: 'I like fresh fish. And salad.',
    })
    expect(JSON.parse(merged.wordsJson)).toHaveLength(6)
  })

  it('tách đúng giữa hai từ, không mất từ hoặc khoảng âm thanh', () => {
    const [left, right] = splitSegment(first, 2)
    expect(left).toMatchObject({ startMs: 1000, endMs: 1450, text: 'I like' })
    expect(right).toMatchObject({
      startMs: 1450,
      endMs: 2300,
      text: 'fresh fish.',
    })
    expect(() => splitSegment(first, 0)).toThrow()
    expect(() => splitSegment(first, 4)).toThrow()
  })
})
