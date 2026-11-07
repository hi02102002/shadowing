import { describe, expect, it } from 'vitest'

import {
  INTONATION_EXAMPLES,
  PILLARS,
  RHYTHM_EXAMPLES,
  STRESS_BASE,
  STRESS_SENTENCES,
  DEFAULT_SHADOWING_SET,
  chunkMarked,
  normalizeShadowingSet,
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

describe('normalizeShadowingSet', () => {
  const raw = {
    sound: [{ text: ' I like fresh fish ', focus: '/ʃ/ trong fresh, fish' }],
    stressWords: ['restaurant', 'delicious.'],
    stressBase: 'I want the chicken salad',
    stressSentences: [
      { stressed: 1, meaning: 'muốn' },
      { stressed: 4, meaning: 'salad' },
      { stressed: 4, meaning: 'trùng' },
      { stressed: 9, meaning: 'lệch' },
    ],
    intonation: [
      { text: 'Is it spicy?', direction: 'rise' as const, stressed: 7, note: 'lên giọng' },
    ],
    rhythm: [{ chunks: ['I would like', ' a table ', 'for two'] }, { chunks: ['Hi'] }],
  }

  it('làm sạch câu, bỏ chỉ số nhấn lệch / trùng, dựng câu nhịp điệu từ cụm', () => {
    const out = normalizeShadowingSet(raw)
    expect(out.sound[0].text).toBe('I like fresh fish')
    expect(out.stressWords).toEqual(['restaurant', 'delicious'])
    expect(out.stressSentences.map((s) => s.stressed)).toEqual([1, 4])
    expect(out.intonation[0].stressed).toBeUndefined()
    expect(out.rhythm).toEqual([
      { text: 'I would like a table for two', chunks: ['I would like', 'a table', 'for two'] },
    ])
  })

  it('phần AI trả thiếu thì dùng bộ mặc định', () => {
    const out = normalizeShadowingSet({
      ...raw,
      sound: [],
      stressSentences: [{ stressed: 0, meaning: 'chỉ một' }],
      rhythm: [],
    })
    expect(out.sound).toBe(DEFAULT_SHADOWING_SET.sound)
    expect(out.stressBase).toBe(DEFAULT_SHADOWING_SET.stressBase)
    expect(out.stressSentences).toBe(DEFAULT_SHADOWING_SET.stressSentences)
    expect(out.rhythm).toBe(DEFAULT_SHADOWING_SET.rhythm)
  })
})
