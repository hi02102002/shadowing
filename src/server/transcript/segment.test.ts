import { describe, expect, it } from 'vitest'

import { parseJson3 } from './json3.ts'
import { segmentWords } from './segment.ts'
import type { TimedWord } from './json3.ts'

/** tạo danh sách từ đều nhau 300ms, chèn khoảng lặng sau các index chỉ định */
function timed(text: string, pausesAfter: Record<number, number> = {}): TimedWord[] {
  let t = 0
  return text.split(' ').map((w, i) => {
    const s = t
    t += 300
    const word = { w, s, e: t }
    t += pausesAfter[i] ?? 50
    return word
  })
}

describe('parseJson3', () => {
  it('phụ đề thủ công: chia timing đều trong event, bỏ [Music]', () => {
    const { words, hasWordTiming } = parseJson3({
      events: [
        { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: '[Music]' }] },
        { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: 'Hello &amp; welcome' }] },
      ],
    })
    expect(hasWordTiming).toBe(false)
    expect(words.map((w) => w.w)).toEqual(['Hello', '&', 'welcome'])
    expect(words[0].s).toBe(2000)
    expect(words[2].e).toBe(3000)
  })

  it('auto-caption: dùng tOffsetMs, bỏ event aAppend', () => {
    const { words, hasWordTiming } = parseJson3({
      events: [
        { tStartMs: 1000, dDurationMs: 3000, segs: [{ utf8: 'so' }, { utf8: ' today', tOffsetMs: 400 }] },
        { tStartMs: 2500, dDurationMs: 10, aAppend: 1, segs: [{ utf8: '\n' }] },
        { tStartMs: 2600, dDurationMs: 2000, segs: [{ utf8: 'we' }, { utf8: ' talk', tOffsetMs: 300 }] },
      ],
    })
    expect(hasWordTiming).toBe(true)
    expect(words).toEqual([
      { w: 'so', s: 1000, e: 1400 },
      { w: 'today', s: 1400, e: 2600 },
      { w: 'we', s: 2600, e: 2900 },
      { w: 'talk', s: 2900, e: 4600 },
    ])
  })
})

describe('segmentWords', () => {
  it('tách theo dấu kết câu', () => {
    const segs = segmentWords(timed('This is the first sentence. And this is the second one.'))
    expect(segs.map((s) => s.text)).toEqual(['This is the first sentence.', 'And this is the second one.'])
    expect(segs[0].startMs).toBe(0)
  })

  it('tách theo khoảng lặng khi không có dấu câu (auto-caption)', () => {
    const segs = segmentWords(timed('so today we are going to talk about habits and why they matter', { 5: 1200 }))
    expect(segs.map((s) => s.text)).toEqual(['So today we are going to', 'Talk about habits and why they matter'])
  })

  it('gộp câu quá ngắn với câu sau', () => {
    const segs = segmentWords(timed('Hi. My name is Anna and I teach English online.'))
    expect(segs).toHaveLength(1)
  })

  it('cắt câu quá dài tại dấu phẩy', () => {
    const long =
      'When I was a kid my family moved a lot, and every time we arrived in a new city I had to make new friends from scratch again.'
    const segs = segmentWords(timed(long), { maxMs: 6000 })
    expect(segs.length).toBeGreaterThan(1)
    expect(segs[0].text.endsWith(',')).toBe(true)
    expect(segs.map((s) => s.text).join(' ').toLowerCase()).toBe(long.toLowerCase())
  })
})

describe('segmentWords — phụ đề có dấu câu', () => {
  it('ngừng lấy hơi giữa câu không cắt câu', () => {
    const text =
      'Welcome back. We upload a new English video every single day to help you improve faster and feel more confident when you speak. Let us start.'
    const segs = segmentWords(timed(text, { 18: 1200 }))
    expect(segs.find((s) => s.text.includes('faster'))?.text).toContain('faster and feel')
  })

  it('không cắt giữa chuỗi liệt kê, đoạn nối tiếp giữ chữ thường', () => {
    const text =
      'This is a complete advanced English speaking practice experience designed to help you sound fluent, confident, and expressive when you communicate with others every day. Good.'
    const segs = segmentWords(timed(text), { maxMs: 6000 })
    const joined = segs.map((s) => s.text)
    expect(joined.some((t) => /^and expressive/i.test(t))).toBe(false)
    expect(joined.slice(1, -1).every((t) => /^[a-z]/.test(t))).toBe(true)
  })
})
