import { describe, expect, it, vi } from 'vitest'

vi.mock('#/db/index.ts', () => ({ db: {} }))
const { cleanDrill } = await import('./grammar')

const q = (over: object) => ({ type: 'fill', prompt: 'She ___ to work.', hint: '(go)', options: [], wrong: '', answers: ['goes'], explanation: '', ...over })

describe('cleanDrill', () => {
  it('giữ câu đúng dạng, chuẩn hoá đáp án trắc nghiệm theo phương án', () => {
    const out = cleanDrill({
      questions: [
        q({}) as never,
        q({ type: 'choice', options: ['go', 'goes', 'going'], answers: ['Goes'] }) as never,
      ],
    })
    expect(out).toHaveLength(2)
    expect(out[1].answers).toEqual(['goes'])
  })

  it('bỏ câu không có hoặc có hai chỗ trống, thiếu đáp án, đáp án không nằm trong phương án', () => {
    const out = cleanDrill({
      questions: [
        q({ prompt: 'She goes to work.' }),
        q({ prompt: 'She ___ to ___.' }),
        q({ answers: [' '] }),
        q({ type: 'choice', options: ['go', 'going'], answers: ['goes'] }),
      ] as never,
    })
    expect(out).toEqual([])
  })

  it('sửa lỗi: phải chỉ ra phần sai có trong câu, chấp nhận cả gõ lại nguyên câu', () => {
    const [fix] = cleanDrill({
      questions: [q({ type: 'fix', prompt: 'She go to work every day.', wrong: 'go', answers: ['goes'] })] as never,
    })
    expect(fix.answers).toEqual(['goes', 'She goes to work every day.'])
    expect(cleanDrill({ questions: [q({ type: 'fix', prompt: 'She goes to work.', wrong: 'went', answers: ['go'] })] as never })).toEqual([])
  })

  it('sắp xếp câu 3–16 từ, viết lại câu không có chỗ trống', () => {
    const out = cleanDrill({
      questions: [
        q({ type: 'order', prompt: 'Cô ấy đang ngủ.', answers: ['She is sleeping.'] }),
        q({ type: 'order', prompt: 'Chào', answers: ['Hi there'] }),
        q({ type: 'rewrite', prompt: 'I started living here in 2010.', hint: 'Dùng "since"', answers: ['I have lived here since 2010.'] }),
      ] as never,
    })
    expect(out.map((x) => x.type)).toEqual(['order', 'rewrite'])
  })
})
