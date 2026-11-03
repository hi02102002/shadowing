import { describe, expect, it, vi } from 'vitest'

vi.mock('#/db/index.ts', () => ({ db: {} }))
const { cleanReading } = await import('./reading')
const { isReadingCorrect: isCorrect, splitPastedText } = await import('#/lib/reading-topics')

const paragraphs = ['Tom moved to Hanoi in 2019. He works as a nurse at a large hospital.', 'He loves the city’s street food.']
const q = (over: object) => ({
  type: 'choice',
  prompt: 'What is Tom’s job?',
  options: ['A teacher', 'A nurse', 'A cook'],
  answers: ['a nurse'],
  evidence: 'He works as a nurse at a large hospital.',
  explanation: '',
  ...over,
})
const clean = (...questions: object[]) => cleanReading({ title: 't', paragraphs, glossary: [], questions } as never)

describe('cleanReading', () => {
  it('chuẩn hoá đáp án theo phương án, TFNG và giữ câu điền từ có một chỗ trống', () => {
    const out = clean(
      q({}),
      q({ type: 'tfng', prompt: 'Tom lives in Hanoi.', options: [], answers: ['not given'] }),
      q({ type: 'gap', prompt: 'Tom is a ___ in a hospital.', options: ['x'], answers: ['nurse'] }),
    )
    expect(out.map((x) => x.answers)).toEqual([['A nurse'], ['Not Given'], ['nurse']])
    expect(out[1].options).toEqual(['True', 'False', 'Not Given'])
    expect(out[2].options).toEqual([])
  })

  it('bỏ câu sai dạng', () => {
    const out = clean(
      q({ answers: ['A doctor'] }),
      q({ options: ['A nurse'] }),
      q({ type: 'tfng', answers: ['Maybe'] }),
      q({ type: 'gap', prompt: 'Tom is a nurse.' }),
      q({ answers: [' '] }),
    )
    expect(out).toEqual([])
  })

  it('giữ trích dẫn có trong bài (bỏ qua nháy cong, hoa thường), bỏ trích dẫn bịa', () => {
    const [a, b] = clean(q({ evidence: '"he loves the city\'s street food."' }), q({ evidence: 'Tom hates noise.' }))
    expect(a.evidence).not.toBe('')
    expect(b.evidence).toBe('')
  })
})

describe('cleanReading: dạng IELTS', () => {
  const headings = ['Moving to a new city', 'Food in Hanoi', 'Life as a nurse']
  it('YNNG, nối tiêu đề trỏ đúng đoạn (căn cứ mặc định là câu đầu), trả lời ngắn', () => {
    const out = clean(
      q({ type: 'ynng', prompt: 'The writer likes Hanoi.', options: [], answers: ['yes'] }),
      q({ type: 'heading', prompt: 'paragraph b', options: headings, answers: ['food in hanoi'], evidence: '' }),
      q({ type: 'short', prompt: 'Where does Tom work?', options: [], answers: ['a large hospital'] }),
    )
    expect(out.map((x) => [x.type, x.prompt, x.answers[0]])).toEqual([
      ['ynng', 'The writer likes Hanoi.', 'Yes'],
      ['heading', 'Paragraph B', 'Food in Hanoi'],
      ['short', 'Where does Tom work?', 'a large hospital'],
    ])
    expect(out[1].evidence).toBe('He loves the city’s street food.')
    expect(isCorrect(out[2], 'A large hospital.')).toBe(true)
  })

  it('bỏ câu nối tiêu đề trỏ đoạn không có, đáp án ngoài danh sách; trả lời ngắn có ___', () => {
    const out = clean(
      q({ type: 'heading', prompt: 'Paragraph D', options: headings, answers: [headings[0]] }),
      q({ type: 'heading', prompt: 'Paragraph A', options: headings, answers: ['Other'] }),
      q({ type: 'short', prompt: 'Tom works in a ___.', options: [], answers: ['hospital'] }),
    )
    expect(out).toEqual([])
  })
})

describe('isReadingCorrect', () => {
  it('so phương án và chấp nhận dạng viết khác khi điền từ', () => {
    const [choice, gap] = clean(q({}), q({ type: 'gap', prompt: 'He doesn’t ___ the food.', answers: ["doesn't like", 'dislike'] }))
    expect(isCorrect(choice, 'A nurse')).toBe(true)
    expect(isCorrect(choice, 'A cook')).toBe(false)
    expect(isCorrect(gap, 'does not like')).toBe(true)
    expect(isCorrect(gap, '')).toBe(false)
  })
})

describe('splitPastedText', () => {
  it('tách đoạn theo dòng trống, gộp dòng xuống trong đoạn', () => {
    expect(splitPastedText('First line\r\ncontinues here.\r\n\r\n  Second   paragraph. \n\n\n')).toEqual([
      'First line continues here.',
      'Second paragraph.',
    ])
  })

  it('không có dòng trống (dán từ web / PDF) thì mỗi dòng một đoạn', () => {
    expect(splitPastedText('One.\nTwo.\nThree.')).toEqual(['One.', 'Two.', 'Three.'])
    // dòng chỉ có khoảng trắng (kể cả NBSP) vẫn là dòng trống
    expect(splitPastedText('One.\nTwo.\n\u00A0\nThree.')).toEqual(['One. Two.', 'Three.'])
  })
})
