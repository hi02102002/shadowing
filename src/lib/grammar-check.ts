import type { GrammarItem } from './grammar.ts'

/**
 * Chuẩn hoá câu trả lời để so: chữ thường, nháy cong → thẳng, gộp khoảng trắng, bỏ dấu câu cuối,
 * mở các dạng rút gọn không nhập nhằng (n't, 'm, 're, 've, 'll). 's và 'd để nguyên vì có nhiều nghĩa,
 * đáp án gốc thường đã liệt kê cả hai dạng ("'s getting / is getting").
 */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.?!])/g, '$1')
    .replace(/^[\s"'.,?!]+|[\s"'.,?!]+$/g, '')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bshan't\b/g, 'shall not')
    .replace(/\bcan't\b|\bcannot\b/g, 'can not')
    .replace(/n't\b/g, ' not')
    .replace(/'m\b/g, ' am')
    .replace(/'re\b/g, ' are')
    .replace(/'ve\b/g, ' have')
    .replace(/'ll\b/g, ' will')
    .replace(/\s+/g, ' ')
    .trim()
    // "không điền gì" có thể gõ - – — x 0
    .replace(/^[-–—x0ø]$/, '-')
}

const matches = (input: string, answers: string[]) => {
  const got = normalizeAnswer(input)
  return got !== '' && answers.some((a) => normalizeAnswer(a) === got)
}

/** câu trả lời của "đúng/sai": "right" hoặc "wrong|<câu sửa>" */
export const encodeRightWrong = (right: boolean, fix = '') => (right ? 'right' : `wrong|${fix}`)
export function decodeRightWrong(answer: string): { right: boolean | null; fix: string } {
  if (answer === 'right') return { right: true, fix: '' }
  if (answer.startsWith('wrong|')) return { right: false, fix: answer.slice(6) }
  return { right: null, fix: '' }
}

/** câu trả lời trắc nghiệm: chỉ số phương án, cách nhau dấu phẩy */
export const encodeChoice = (picked: number[]) => [...picked].sort((a, b) => a - b).join(',')
export const decodeChoice = (answer: string) =>
  answer ? answer.split(',').map(Number).filter((n) => Number.isInteger(n)) : []

export function checkAnswer(item: GrammarItem, answer: string): boolean {
  switch (item.kind) {
    case 'text':
    case 'match':
      return matches(answer, item.answers)
    case 'choice':
      return encodeChoice(decodeChoice(answer)) === encodeChoice(item.correct)
    case 'rightWrong': {
      const { right, fix } = decodeRightWrong(answer)
      if (right === null) return false
      if (item.right) return right
      // câu sai mà sách không ghi cách sửa → chỉ cần chọn đúng là "sai"
      return !right && (!item.fixes.length || matches(fix, item.fixes))
    }
  }
}
