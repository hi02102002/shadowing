import { describe, expect, it } from 'vitest'

import type { GrammarItem } from './grammar.ts'
import { checkAnswer, encodeChoice, encodeRightWrong, normalizeAnswer } from './grammar-check.ts'

const text = (...answers: string[]): GrammarItem => ({ kind: 'text', answers, example: false, long: false, prompt: '' })

describe('normalizeAnswer', () => {
  it('bỏ hoa/thường, nháy cong, khoảng trắng thừa và dấu câu cuối', () => {
    expect(normalizeAnswer('  How often  do you play Tennis ? ')).toBe('how often do you play tennis')
    expect(normalizeAnswer('It’s getting')).toBe("it's getting")
  })

  it('mở các dạng rút gọn không nhập nhằng', () => {
    expect(normalizeAnswer("I'm not enjoying")).toBe('i am not enjoying')
    expect(normalizeAnswer("didn't see")).toBe(normalizeAnswer('did not see'))
    expect(normalizeAnswer("won't")).toBe('will not')
    expect(normalizeAnswer("can't")).toBe(normalizeAnswer('cannot'))
    expect(normalizeAnswer("they've gone")).toBe('they have gone')
  })

  it('"không điền gì" gõ bằng gạch ngang hoặc x', () => {
    for (const s of ['-', '–', '—', 'x', 'X']) expect(normalizeAnswer(s)).toBe('-')
  })
})

describe('checkAnswer', () => {
  it('chấp nhận mọi đáp án liệt kê và dạng rút gọn tương đương', () => {
    const item = text("'s getting", 'is getting')
    expect(checkAnswer(item, 'is getting')).toBe(true)
    expect(checkAnswer(item, "'s getting")).toBe(true)
    expect(checkAnswer(item, 'gets')).toBe(false)
    expect(checkAnswer(item, '   ')).toBe(false)
    expect(checkAnswer(text("didn't see"), 'did not see')).toBe(true)
    expect(checkAnswer(text('-'), '–')).toBe(true)
  })

  it('trắc nghiệm: đúng đủ tập phương án, không phụ thuộc thứ tự', () => {
    const item: GrammarItem = { kind: 'choice', options: ['a', 'b', 'c'], correct: [0, 2], multi: true, prompt: '' }
    expect(checkAnswer(item, encodeChoice([2, 0]))).toBe(true)
    expect(checkAnswer(item, encodeChoice([0]))).toBe(false)
    expect(checkAnswer(item, '')).toBe(false)
  })

  it('đúng/sai: câu sai phải sửa đúng, câu sai không có cách sửa chỉ cần chọn "sai"', () => {
    const wrong: GrammarItem = { kind: 'rightWrong', right: false, fixes: ['is trying'], prompt: '' }
    expect(checkAnswer(wrong, encodeRightWrong(false, 'Is trying'))).toBe(true)
    expect(checkAnswer(wrong, encodeRightWrong(false, 'tries'))).toBe(false)
    expect(checkAnswer(wrong, encodeRightWrong(true))).toBe(false)
    const right: GrammarItem = { kind: 'rightWrong', right: true, fixes: [], prompt: '' }
    expect(checkAnswer(right, encodeRightWrong(true))).toBe(true)
    expect(checkAnswer(right, encodeRightWrong(false, 'x'))).toBe(false)
    const noFix: GrammarItem = { kind: 'rightWrong', right: false, fixes: [], prompt: '' }
    expect(checkAnswer(noFix, encodeRightWrong(false))).toBe(true)
  })
})
