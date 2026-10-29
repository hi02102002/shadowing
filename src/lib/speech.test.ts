import { describe, expect, it } from 'vitest'

import { splitForSpeech } from './speech'

describe('splitForSpeech', () => {
  it('tách theo câu', () => {
    expect(splitForSpeech('Hi there! What would you like? A latte.')).toEqual(['Hi there!', 'What would you like?', 'A latte.'])
  })

  it('câu dài hơn giới hạn thì tách ở khoảng trắng, không mất chữ', () => {
    const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')
    const parts = splitForSpeech(long, 50)
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(50)
    expect(parts.join(' ')).toBe(long)
  })

  it('chuỗi rỗng', () => {
    expect(splitForSpeech('  ')).toEqual([])
  })
})
