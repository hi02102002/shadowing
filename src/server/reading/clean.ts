import type { ReadingQuestion } from '#/db/schema.ts'
import { normalizeAnswer } from '#/lib/grammar-check.ts'
import { TFNG_OPTIONS, YNNG_OPTIONS } from '#/lib/reading-topics.ts'
import type { ReadingPassage } from '../ai/prompts.ts'

const flat = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

const pickFrom = (options: string[], answer: string) =>
  options.find((o) => normalizeAnswer(o) === normalizeAnswer(answer))

/** Lọc và chuẩn hoá bộ câu hỏi AI trước khi lưu. */
export function cleanReading(passage: ReadingPassage): ReadingQuestion[] {
  const body = flat(passage.paragraphs.join(' '))
  return passage.questions.flatMap((q) => {
    const answers = q.answers.map((a) => a.trim()).filter(Boolean)
    if (!answers.length || !q.prompt.trim()) return []
    const evidence = q.evidence.trim().replace(/^["“]|["”]$/g, '')
    const base = {
      ...q,
      prompt: q.prompt.trim(),
      options: [],
      answers,
      evidence: evidence && body.includes(flat(evidence)) ? evidence : '',
    }
    const blanks = base.prompt.split('___').length - 1
    switch (q.type) {
      case 'choice': {
        const options = [
          ...new Set(q.options.map((o) => o.trim()).filter(Boolean)),
        ]
        const right = options.find(
          (o) => normalizeAnswer(o) === normalizeAnswer(answers[0]),
        )
        return right && options.length >= 2
          ? [{ ...base, options, answers: [right] }]
          : []
      }
      case 'tfng':
      case 'ynng': {
        const options = q.type === 'tfng' ? TFNG_OPTIONS : YNNG_OPTIONS
        const right = pickFrom(options, answers[0])
        return right ? [{ ...base, options, answers: [right] }] : []
      }
      case 'heading': {
        const letter = /^paragraph\s+([A-Z])$/i
          .exec(base.prompt)?.[1]
          .toUpperCase()
        const paragraph = letter
          ? passage.paragraphs[letter.charCodeAt(0) - 65]
          : undefined
        const options = [
          ...new Set(q.options.map((o) => o.trim()).filter(Boolean)),
        ]
        const right = pickFrom(options, answers[0])
        if (!letter || !paragraph || !right || options.length < 3) return []
        const topic = /^.*?[.!?](\s|$)/.exec(paragraph)?.[0].trim() ?? paragraph
        return [
          {
            ...base,
            prompt: `Paragraph ${letter}`,
            options,
            answers: [right],
            evidence: base.evidence || topic,
          },
        ]
      }
      case 'gap':
        return blanks === 1 ? [base] : []
      case 'short':
        return blanks ? [] : [base]
    }
  })
}
