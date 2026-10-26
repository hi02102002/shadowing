import { Rating, createEmptyCard } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'

import { formatInterval } from '#/lib/format.ts'
import { fromFsrsCard, previewIntervals, review } from './srs.ts'

const now = new Date('2026-01-01T00:00:00Z')
const fresh = () => fromFsrsCard(createEmptyCard(now))

describe('review', () => {
  it('thẻ mới chấm Good → lùi hạn, tăng reps, sang Learning', () => {
    const { fields, log } = review(fresh(), Rating.Good, now)
    expect(fields.due.getTime()).toBeGreaterThan(now.getTime())
    expect(fields.reps).toBe(1)
    expect(fields.state).toBe(1)
    expect(log.rating).toBe(Rating.Good)
  })

  it('Easy cho khoảng ôn dài hơn Again', () => {
    const again = review(fresh(), Rating.Again, now).fields.due.getTime()
    const easy = review(fresh(), Rating.Easy, now).fields.due.getTime()
    expect(easy).toBeGreaterThan(again)
  })
})

describe('previewIntervals', () => {
  it('trả nhãn cho cả 4 mức', () => {
    const p = previewIntervals(fresh(), now)
    expect(p[Rating.Again]).toBe('1 phút')
    expect(Object.keys(p)).toHaveLength(4)
  })
})

describe('formatInterval', () => {
  it('đổi đơn vị theo độ dài', () => {
    expect(formatInterval(10 * 60_000)).toBe('10 phút')
    expect(formatInterval(3 * 86_400_000)).toBe('3 ngày')
    expect(formatInterval(400 * 86_400_000)).toBe('1 năm')
  })
})
