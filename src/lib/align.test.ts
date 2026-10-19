import { describe, expect, it } from 'vitest'

import { alignWords, expandWord, firstLetterHint, numberToWords } from './align.ts'

const ops = (ref: string, hyp: string) => alignWords(ref, hyp).tokens.map((t) => `${t.op}:${t.ref || t.hyp}`)

describe('alignWords', () => {
  it('chấm đúng 100% khi chỉ khác hoa/thường và dấu câu', () => {
    const r = alignWords('Hello, World! How are you?', 'hello world how are you')
    expect(r.score).toBe(100)
    expect(r.tokens.every((t) => t.op === 'correct')).toBe(true)
  })

  it('phát hiện từ sai, thiếu và thừa', () => {
    expect(ops('I want to go home', 'I wanna go to home now')).toEqual([
      'correct:I',
      'correct:want',
      'correct:to',
      'correct:go',
      'extra:to',
      'correct:home',
      'extra:now',
    ])
    expect(ops('She sells sea shells', 'She sell shells')).toEqual([
      'correct:She',
      'wrong:sells',
      'missing:sea',
      'correct:shells',
    ])
  })

  it('coi contraction và dạng đầy đủ là như nhau', () => {
    expect(alignWords("I don't know what it's like", 'I do not know what it is like').score).toBe(100)
    expect(alignWords('I cannot go', "I can't go").score).toBe(100)
  })

  it('gom lỗi về một từ gốc khi contraction bị nghe thiếu', () => {
    const r = alignWords("I don't know", 'I do know')
    expect(r.tokens.map((t) => t.op)).toEqual(['correct', 'wrong', 'correct'])
    expect(r.tokens[1]).toMatchObject({ ref: "don't", hyp: 'do' })
  })

  it('so khớp số với chữ', () => {
    expect(alignWords('I am 20 years old', 'I am twenty years old').score).toBe(100)
    expect(alignWords('It costs 125 dollars', 'it costs one hundred twenty five dollars').score).toBe(100)
  })

  it('xử lý dấu nháy cong', () => {
    expect(alignWords('It’s fine', "it's fine").score).toBe(100)
  })

  it('trả điểm 0 cho input rỗng', () => {
    const r = alignWords('Good morning everyone', '')
    expect(r.score).toBe(0)
    expect(r.tokens.every((t) => t.op === 'missing')).toBe(true)
  })

  it('trừ điểm cho từ thừa nhưng không âm', () => {
    expect(alignWords('yes', 'yes yes yes yes').score).toBe(0)
  })
})

describe('helpers', () => {
  it('numberToWords', () => {
    expect(numberToWords(0)).toBe('zero')
    expect(numberToWords(42)).toBe('forty two')
    expect(numberToWords(300)).toBe('three hundred')
    expect(numberToWords(2026)).toBe('2026')
  })
  it('expandWord', () => {
    expect(expandWord("Won't,")).toEqual(['will', 'not'])
    expect(expandWord('—')).toEqual([])
  })
  it('firstLetterHint', () => {
    expect(firstLetterHint("Don't stop, 2 times")).toBe("D__'_ s___, 2 t____")
  })
})
