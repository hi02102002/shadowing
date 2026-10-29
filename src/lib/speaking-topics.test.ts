import { describe, expect, it } from 'vitest'

import { parseCueCard } from './speaking-topics'

describe('parseCueCard', () => {
  it('đọc đề dán từ sách: bỏ "You should say", gạch đầu dòng và dòng trống', () => {
    const text = `Describe a place where you live or have lived that you really like.

You should say:

- where it is
    
- what the place is like
    
- what you usually do there
    
- and explain why you like living there.`
    expect(parseCueCard(text)).toEqual({
      title: 'Describe a place where you live or have lived that you really like.',
      bullets: ['where it is', 'what the place is like', 'what you usually do there', 'and explain why you like living there.'],
    })
  })

  it('chỉ có đề, không gợi ý', () => {
    expect(parseCueCard('Describe your favourite season.')).toEqual({ title: 'Describe your favourite season.', bullets: [] })
  })

  it('rỗng', () => {
    expect(parseCueCard('  \n ')).toBeNull()
  })
})
