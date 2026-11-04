import { describe, expect, it } from 'vitest'

import { createChunkMatcher, normalizeChunk } from './chunk-match'

describe('nhận diện chunk trong bài', () => {
  const matcher = createChunkMatcher([
    ['give up', 'give up'],
    ['gave up', 'give up'],
    ['give up on', 'give up on'],
    ['of course', 'of course'],
    ['i want to', 'I want to …'],
    ['hello', 'từ đơn bị bỏ'],
  ])

  it('tìm theo dạng chia, trả lại đúng chữ trong bài, mỗi chunk một lần', () => {
    const found = matcher.find(
      'She GAVE UP smoking. Of course, I want to give up too. Of course!',
    )
    expect(found.map((f) => [f.item, f.surface])).toEqual([
      ['give up', 'GAVE UP'],
      ['of course', 'Of course'],
      ['I want to …', 'I want to'],
    ])
  })

  it('ưu tiên cụm dài nhất ở cùng vị trí', () => {
    expect(
      matcher.find('Never give up on your dreams.').map((f) => f.item),
    ).toEqual(['give up on'])
  })

  it('bỏ qua từ đơn và chuẩn hoá dấu nháy cong', () => {
    expect(matcher.find('hello there')).toEqual([])
    expect(normalizeChunk('I’m  afraid…')).toBe("i'm afraid")
  })
})
