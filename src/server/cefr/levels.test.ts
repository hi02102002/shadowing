import { describe, expect, it } from 'vitest'
import { sentenceWords, wordLevel } from './levels'

describe('wordLevel', () => {
  it('tra cấp theo dạng gốc', () => {
    expect(wordLevel('went')).toEqual({ lemma: 'go', level: 'A1', pos: ['verb'] })
    expect(wordLevel('children')?.lemma).toBe('child')
    expect(wordLevel('Negotiating')?.lemma).toBe('negotiate')
    expect(wordLevel('relatives')?.lemma).toBe('relative')
  })

  it('từ đã đổi dạng chỉ giữ từ loại ứng với cách biến đổi, từ nguyên dạng giữ mọi từ loại', () => {
    expect(wordLevel('negotiating')?.pos).toEqual(['verb'])
    expect(wordLevel('relatives')?.pos).toEqual(['noun'])
    expect(wordLevel('general')?.pos).toEqual(expect.arrayContaining(['adjective', 'noun']))
  })

  it('có cả C1/C2 (Octanove) và bỏ qua từ ngoài danh sách', () => {
    expect(wordLevel('timid')?.level).toBe('C1')
    expect(wordLevel('Sorokin')).toBeNull()
  })
})

describe('sentenceWords', () => {
  it('bỏ sở hữu cách, dạng rút gọn và số', () => {
    expect(sentenceWords("Anne's husband doesn't live in 2 houses, I’m sure.")).toEqual([
      'Anne',
      'husband',
      'live',
      'in',
      'houses',
      'sure',
    ])
  })
})
