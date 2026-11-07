import { describe, expect, it } from 'vitest'

import { clipContext, findPhrase, normalizeToken } from './clip-match'
import type { ClipWord } from './clip-match'

/** mỗi từ dài 400ms, cách nhau 100ms */
const timed = (text: string, startMs = 0): ClipWord[] =>
  text
    .split(' ')
    .map((w, i) => ({ w, s: startMs + i * 500, e: startMs + i * 500 + 400 }))

describe('normalizeToken', () => {
  it('bỏ dấu câu, giữ nháy trong từ rút gọn', () => {
    expect(normalizeToken('Don’t,')).toBe("don't")
    expect(normalizeToken('"Fish!"')).toBe('fish')
    expect(normalizeToken("'cause")).toBe('cause')
  })
})

describe('findPhrase', () => {
  it('khớp cụm nhiều từ, bỏ qua hoa thường và dấu câu', () => {
    const words = timed('We have plenty of time, plenty of food.')
    const m = findPhrase(words, 'Plenty of')
    expect(m.map((x) => x.from)).toEqual([2, 5])
    expect(m[0]).toMatchObject({
      to: 3,
      startMs: 1000,
      endMs: 1900,
      exact: true,
    })
  })

  it('khớp nguyên từ: fish không khớp selfish', () => {
    expect(
      findPhrase(timed("Don't be selfish, eat fish"), 'fish').map(
        (x) => x.from,
      ),
    ).toEqual([4])
    expect(findPhrase(timed("I don't know"), "don't")).toHaveLength(1)
  })

  it('từ đơn nhận dạng chia, khớp nguyên dạng xếp trước', () => {
    const m = findPhrase(
      timed('She walked home then walks and walking but walk'),
      'walk',
    )
    expect(m.map((x) => [x.from, x.exact])).toEqual([
      [8, true],
      [1, false],
      [4, false],
      [6, false],
    ])
    expect(findPhrase(timed('making it'), 'make')).toHaveLength(1)
    expect(findPhrase(timed('it stopped'), 'stop')).toHaveLength(1)
    expect(findPhrase(timed('she studies'), 'study')).toHaveLength(1)
    // cụm từ thì không nhận dạng chia
    expect(findPhrase(timed('fans of'), 'fan of')).toHaveLength(0)
  })
})

describe('clipContext', () => {
  it('lấy câu quanh cụm từ và vị trí để tô đậm', () => {
    const words = timed('one two three four five six seven eight nine ten')
    const [m] = findPhrase(words, 'five six')
    const ctx = clipContext(words, m)
    expect(ctx.sentence.slice(...ctx.highlight)).toBe('five six')
    expect(ctx.startMs).toBeLessThanOrEqual(m.startMs - 1000)
    expect(ctx.endMs).toBeGreaterThanOrEqual(m.endMs + 1000)
    expect(ctx.sentence).not.toContain('one')
  })

  it('không vượt ra ngoài câu khi biết ranh giới câu', () => {
    const words = timed('Hello there. I like fresh fish today.')
    const [m] = findPhrase(words, 'fresh fish')
    const ctx = clipContext(words, m, { startMs: 1000, endMs: 3400 })
    expect(ctx.sentence).toBe('I like fresh fish today.')
    expect(ctx.sentence.slice(...ctx.highlight)).toBe('fresh fish')
    expect(ctx.startMs).toBe(1000)
  })
})
