import { describe, expect, it } from 'vitest'

import { bankPrompts } from './reflex-bank'
import {
  REFLEX_LEVELS,
  REFLEX_MODES,
  defaultAnswerSeconds,
  levelByLength,
  sample,
} from './reflex'

describe('bộ câu phản xạ có sẵn', () => {
  it('mỗi dạng bài × cấp độ đủ 10 câu, có câu mẫu, không trùng', () => {
    for (const mode of REFLEX_MODES)
      for (const level of REFLEX_LEVELS) {
        const items = bankPrompts(mode, level)
        expect(items, `${mode} ${level}`).toHaveLength(10)
        expect(new Set(items.map((i) => i.prompt)).size).toBe(10)
        for (const i of items) expect(i.reference?.trim()).toBeTruthy()
      }
  })

  it('mẫu câu có chỗ trống và từ cần ghép', () => {
    for (const level of REFLEX_LEVELS)
      for (const i of bankPrompts('pattern', level)) {
        expect(i.prompt).toContain('___')
        expect(i.hint).toBeTruthy()
      }
  })

  it('câu hỏi đọc to bằng tiếng Anh, câu dịch là tiếng Việt', () => {
    expect(bankPrompts('qa', 'B1')[0].promptLang).toBe('en')
    expect(bankPrompts('translate', 'B1')[0].promptLang).toBe('vi')
  })
})

describe('tiện ích phản xạ', () => {
  it('cấp độ theo độ dài câu', () => {
    expect(levelByLength(4)).toBe('A1')
    expect(levelByLength(8)).toBe('A2')
    expect(levelByLength(10)).toBe('B1')
    expect(levelByLength(15)).toBe('B2')
    expect(levelByLength(25)).toBe('C1')
  })

  it('thời gian mặc định tăng theo cấp độ và dạng khó hơn', () => {
    expect(defaultAnswerSeconds('translate', 'A1')).toBeLessThan(
      defaultAnswerSeconds('translate', 'C1'),
    )
    expect(defaultAnswerSeconds('situation', 'B1')).toBeGreaterThan(
      defaultAnswerSeconds('translate', 'B1'),
    )
  })

  it('sample bốc không trùng và không quá số phần tử', () => {
    const out = sample([1, 2, 3, 4, 5], 3)
    expect(out).toHaveLength(3)
    expect(new Set(out).size).toBe(3)
    expect(sample([1, 2], 5)).toHaveLength(2)
  })
})
