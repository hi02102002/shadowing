import { describe, expect, it, vi } from 'vitest'

vi.mock('#/db/index.ts', () => ({ db: {} }))
const { chunkSegments } = await import('./vocab')

const seg = (idx: number, len: number) => ({ idx, text: 'x'.repeat(len) })

describe('chunkSegments', () => {
  it('video ngắn: một phần', () => {
    expect(chunkSegments([seg(0, 100), seg(1, 100)])).toHaveLength(1)
  })

  it('video dài: chia nhiều phần ≤ 15k ký tự, giữ thứ tự, không bỏ câu', () => {
    const segs = Array.from({ length: 400 }, (_, i) => seg(i, 100))
    const chunks = chunkSegments(segs)
    expect(chunks.length).toBe(3)
    expect(chunks.flat().map((s) => s.idx)).toEqual(segs.map((s) => s.idx))
    for (const c of chunks) expect(c.reduce((n, s) => n + s.text.length + 8, 0)).toBeLessThanOrEqual(15_000)
  })

  it('tối đa 8 phần cho video rất dài', () => {
    const chunks = chunkSegments(Array.from({ length: 5000 }, (_, i) => seg(i, 100)))
    expect(chunks).toHaveLength(8)
  })
})
