import { describe, expect, it } from 'vitest'

import {
  INTONATION_EXAMPLES,
  PILLARS,
  RHYTHM_EXAMPLES,
  STRESS_BASE,
  STRESS_SENTENCES,
  chunkMarked,
  pillarOfMistake,
  stressVariant,
} from './shadowing-basics'

describe('shadowing basics', () => {
  it('đủ 4 trụ cột, không trùng id', () => {
    expect(PILLARS.map((p) => p.id)).toEqual([
      'sound',
      'stress',
      'intonation',
      'rhythm',
    ])
  })

  it('các cụm nối lại đúng câu gốc', () => {
    for (const ex of RHYTHM_EXAMPLES) {
      expect(ex.chunks.length).toBeGreaterThan(1)
      expect(ex.chunks.join(' ')).toBe(ex.text)
    }
    expect(chunkMarked(['I', 'need', 'to call', 'my mom'])).toBe(
      'I/ need/ to call/ my mom',
    )
  })

  it('từ nhấn nằm trong câu', () => {
    const words = STRESS_BASE.split(' ')
    for (const s of STRESS_SENTENCES) expect(words[s.stressed]).toBeTruthy()
    for (const ex of INTONATION_EXAMPLES) {
      if (ex.stressed != null)
        expect(ex.text.split(' ')[ex.stressed]).toBeTruthy()
    }
  })

  it('viết hoa đúng từ được nhấn', () => {
    expect(stressVariant(STRESS_BASE, 1)).toBe('I REALLY like this movie')
    expect(stressVariant(STRESS_BASE, 4)).toBe('I really like this MOVIE')
  })

  it('xếp loại lỗi vào đúng trụ cột', () => {
    expect(pillarOfMistake('ending_sound')).toBe('sound')
    expect(pillarOfMistake('stress')).toBe('stress')
    expect(pillarOfMistake('intonation')).toBe('intonation')
    expect(pillarOfMistake('linking')).toBe('rhythm')
    expect(pillarOfMistake('vocabulary')).toBeNull()
  })
})
