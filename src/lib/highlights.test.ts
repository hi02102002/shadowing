import { describe, expect, it } from 'vitest'

import { addHighlight, eraseRange, splitPieces } from './highlights'
import type { HighlightColor } from './highlights'

const h = (p: number, start: number, end: number, color: HighlightColor = 'yellow') => ({ p, start, end, color })

describe('addHighlight', () => {
  it('đè lên phần trùng của vùng khác màu, gộp vùng cùng màu liền kề', () => {
    const list = [h(0, 0, 10, 'green')]
    expect(addHighlight(list, h(0, 5, 15))).toEqual([h(0, 0, 5, 'green'), h(0, 5, 15)])
    expect(addHighlight([h(0, 0, 5)], h(0, 5, 9))).toEqual([h(0, 0, 9)])
    expect(addHighlight([h(1, 0, 5)], h(0, 5, 9))).toEqual([h(0, 5, 9), h(1, 0, 5)])
  })

  it('bỏ qua vùng rỗng', () => {
    expect(addHighlight([], h(0, 3, 3))).toEqual([])
  })
})

describe('eraseRange', () => {
  it('xoá giữa vùng thì tách đôi', () => {
    expect(eraseRange([h(0, 0, 10)], 0, 3, 6)).toEqual([h(0, 0, 3), h(0, 6, 10)])
  })
})

describe('splitPieces', () => {
  it('chia theo vùng tô và vùng đang chỉ ra', () => {
    const pieces = splitPieces(12, 0, [h(1, 0, 3), h(0, 2, 6, 'pink')], [4, 9])
    expect(pieces.map((x) => [x.start, x.end, x.highlight, x.color, x.marked])).toEqual([
      [0, 2, null, null, false],
      [2, 4, 1, 'pink', false],
      [4, 6, 1, 'pink', true],
      [6, 9, null, null, true],
      [9, 12, null, null, false],
    ])
  })
})
