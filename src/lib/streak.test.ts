import { describe, expect, it } from 'vitest'
import { addDays, computeStreak } from './streak'

describe('computeStreak', () => {
  it('đếm chuỗi tính cả hôm nay', () => {
    expect(computeStreak(['2026-10-27', '2026-10-28', '2026-10-29'], '2026-10-29')).toEqual({
      current: 3,
      longest: 3,
      today: true,
    })
  })

  it('hôm nay chưa học: giữ chuỗi đến hôm qua; nghỉ một ngày thì mất chuỗi', () => {
    expect(computeStreak(['2026-10-27', '2026-10-28'], '2026-10-29').current).toBe(2)
    expect(computeStreak(['2026-10-26', '2026-10-27'], '2026-10-29').current).toBe(0)
  })

  it('chuỗi dài nhất qua các khoảng nghỉ, kể cả qua tháng', () => {
    const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-10', '2026-10-29']
    expect(computeStreak(days, '2026-10-29')).toEqual({ current: 1, longest: 4, today: true })
  })

  it('addDays qua cuối năm', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})
