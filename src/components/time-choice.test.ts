import { describe, expect, it } from 'vitest'

import { formatSeconds } from './time-choice'
import {
  PREP_CHOICES,
  PREP_LIMIT,
  SPEAK_CHOICES,
  SPEAK_SECONDS_LIMIT,
  TALK_TURN_CHOICES,
  TALK_TURN_LIMIT,
} from '#/lib/speaking-topics'

describe('chọn thời gian luyện nói', () => {
  it('hiển thị giây / phút dễ đọc', () => {
    expect(formatSeconds(0)).toBe('Không')
    expect(formatSeconds(45)).toBe('45 giây')
    expect(formatSeconds(120)).toBe('2 phút')
    expect(formatSeconds(90)).toBe('1:30')
  })

  it('nút chọn nhanh nằm trong giới hạn server cho phép', () => {
    expect(Math.max(...PREP_CHOICES)).toBeLessThanOrEqual(PREP_LIMIT)
    expect(Math.max(...SPEAK_CHOICES)).toBeLessThanOrEqual(SPEAK_SECONDS_LIMIT)
    expect(Math.max(...TALK_TURN_CHOICES)).toBeLessThanOrEqual(TALK_TURN_LIMIT)
  })
})
