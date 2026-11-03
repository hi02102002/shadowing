/**
 * Reading for the Real World 1–3 trên essentialenglish.review (mục Reading): mỗi sách 12 unit × 2 bài.
 * Trang bài có sẵn câu hỏi kèm đáp án trong HTML nên dùng luôn câu hỏi gốc của sách, không cần AI soạn.
 */
import { HTMLElement, parse } from 'node-html-parser'

import type { ReadingQuestion } from '#/db/schema.ts'
import type { ReadingLevel } from '#/lib/reading-topics.ts'
import type { LibraryArticle, LibraryItem } from './sources.ts'

export const EE_SITE = 'https://www.essentialenglish.review/'

/** site chỉ ghi "intermediate to advanced"; cấp CEFR ước theo số sách */
export const EE_READING_BOOKS: Array<{
  slug: string
  label: string
  levels: ReadingLevel[]
}> = [
  {
    slug: 'reading-for-the-real-world-1',
    label: 'Real World 1 · B1',
    levels: ['B1'],
  },
  {
    slug: 'reading-for-the-real-world-2',
    label: 'Real World 2 · B1–B2',
    levels: ['B1', 'B2'],
  },
  {
    slug: 'reading-for-the-real-world-3',
    label: 'Real World 3 · B2–C1',
    levels: ['B2', 'C1'],
  },
]

export const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const comparable = (s: string) =>
  clean(s)
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .toLowerCase()
/** chữ trong phần tử, bỏ số chú thích <sup>n</sup> */
export const textOf = (el: HTMLElement) => {
  const copy = parse(el.outerHTML)
  copy.querySelectorAll('sup').forEach((n) => n.remove())
  return clean(copy.text)
}

/** mục lục trang sách: link tới từng bài, bỏ #thứ-tự, giữ thứ tự xuất hiện */
export function parseEssentialBook(
  html: string,
  book: (typeof EE_READING_BOOKS)[number],
): LibraryItem[] {
  const seen = new Set<string>()
  return parse(html)
    .querySelectorAll(`a[href^="/book/${book.slug}/"]`)
    .flatMap((a): LibraryItem[] => {
      const path = (a.getAttribute('href') ?? '').split('#')[0]
      const title = clean(a.text)
      if (seen.has(path) || !title) return []
      seen.add(path)
      return [
        {
          source: 'essential',
          url: new URL(path, EE_SITE).toString(),
          title,
          levels: book.levels,
          levelLabel: book.label,
        },
      ]
    })
}

/** "a. To explain…" → "To explain…" (giao diện tự đánh (A)–(D)); nhãn hoa "A Text" của đề IELTS thì giữ */
const stripLetter = (s: string) => s.replace(/^[a-h][.)]\s+/, '')

const OPTION_SETS: Array<{ type: 'tfng' | 'ynng'; options: string[] }> = [
  { type: 'tfng', options: ['True', 'False', 'Not Given'] },
  { type: 'ynng', options: ['Yes', 'No', 'Not Given'] },
]

const base = { evidence: '', explanation: '' }

/**
 * Câu hỏi trong một khung bài tập của trang (div.word-free-cover), mọi dạng có đáp án trên site:
 * - chọn một (`answer-index` đếm từ 0); True/False/Not Given, Yes/No/Not Given đổi thành dạng riêng
 * - chọn nhiều ("Choose TWO letters", `answer-index="1,3"`)
 * - điền từ (`text` là đáp án, nhiều cách viết cách nhau " / "); có hộp từ gợi ý thì thành trắc nghiệm chọn trong hộp
 * Câu tự luận (đáp án mẫu dài) không chấm được nên bỏ.
 */
export function coverQuestions(
  cover: HTMLElement,
  instruction?: string,
  outsideBox: string[] = [],
): ReadingQuestion[] {
  const extra = instruction ? { instruction } : {}
  const choices = cover
    .querySelectorAll('li.answer-the-questions-section')
    .flatMap((li): ReadingQuestion[] => {
      const multi = li.querySelector('ul.ul-multi-choose-answer')
      const list = multi ?? li.querySelector('ul.ul-choose-answer')
      if (!list) return []
      const options = list
        .querySelectorAll('li')
        .map((o) => stripLetter(textOf(o)))
      list.remove()
      const picked = (li.getAttribute('answer-index') ?? '')
        .split(',')
        .map((x) => options[Number(x.trim())])
      const prompt = textOf(li)
      if (picked.some((x) => !x) || options.length < 2) return []
      if (multi)
        return [
          {
            type: 'multi',
            prompt,
            options,
            answers: picked,
            ...base,
            ...extra,
          },
        ]
      if (!prompt) return []
      const set = OPTION_SETS.find(
        (o) =>
          o.options.length === options.length &&
          o.options.every(
            (x, k) => x.toLowerCase() === options[k].toLowerCase(),
          ),
      )
      return [
        {
          type: set?.type ?? 'choice',
          prompt,
          options: set?.options ?? options,
          answers: [set ? set.options[options.indexOf(picked[0])] : picked[0]],
          ...base,
          ...extra,
        },
      ]
    })
  // nối tiêu đề: value là tiêu đề đúng (kèm số La Mã), danh sách tiêu đề nằm trong khung
  const matchesEls = cover.querySelectorAll(
    'li.answer-the-questions-section-word-blank',
  )
  const listedHeadings = cover
    .querySelectorAll('ol.ul-free-option li')
    .map(textOf)
  // một số bài nối đáp án không có ol: mỗi `value="B There are…"` chính là một phương án của khung
  const valueHeadings = [
    ...new Set(
      matchesEls
        .map((li) => clean(li.getAttribute('value') ?? ''))
        .filter(Boolean),
    ),
  ]
  const headings = listedHeadings.length ? listedHeadings : valueHeadings
  const matches = matchesEls.flatMap((li): ReadingQuestion[] => {
    const value = clean(li.getAttribute('value') ?? '')
    const right = headings.find((h) => comparable(h) === comparable(value))
    const prompt = textOf(li)
    return right && prompt
      ? [
          {
            type: 'heading',
            prompt,
            options: headings,
            answers: [right],
            ...base,
            ...extra,
          },
        ]
      : []
  })
  // Tactics: đáp án đúng nằm trong thuộc tính text, phương án trong ol.ul-free-option
  const chars = cover
    .querySelectorAll('.answer-the-questions-section-char')
    .flatMap((el): ReadingQuestion[] => {
      const answer = clean(el.getAttribute('text') ?? '')
      const list =
        el.querySelector('ol.ul-free-option, ul.ul-free-option') ??
        cover.querySelector('ol.ul-free-option, ul.ul-free-option')
      const options = list?.querySelectorAll('li').map(textOf) ?? []
      list?.remove()
      const prompt = textOf(el)
      const right = options.find((o) => comparable(o) === comparable(answer))
      return prompt && right && options.length >= 2
        ? [
            {
              type: 'choice',
              prompt,
              options,
              answers: [right],
              ...base,
              ...extra,
            },
          ]
        : []
    })
  return [
    ...matches,
    ...choices,
    ...chars,
    ...gapQuestions(cover, extra, outsideBox),
  ]
}

const BLANK = (i: number) => `{{${i}}}`
const MAX_CONTEXT = 220

/** "10(th) September" → ["10th September", "10 September"]: phần trong ngoặc là tuỳ chọn */
export function expandAnswer(answer: string): string[] {
  const m = /\(([^)]*)\)/.exec(answer)
  if (!m) return [answer]
  const rest = (s: string) => expandAnswer(clean(s))
  return [
    ...rest(answer.replace(m[0], m[1])),
    ...rest(answer.replace(m[0], '')),
  ]
}

/**
 * Chỗ trống điền từ: ngữ cảnh là dòng chứa chỗ trống trong khối gần nhất (li, ô bảng kèm tên hàng),
 * trong đoạn văn hoặc dòng quá dài thì chỉ lấy câu chứa nó; các chỗ trống khác hiện "…".
 */
function gapQuestions(
  cover: HTMLElement,
  extra: { instruction?: string },
  outsideBox: string[],
): ReadingQuestion[] {
  const inside = cover.querySelectorAll('ul.ul-free-option-none li').map(textOf)
  const box = inside.length ? inside : outsideBox
  const copy = parse(cover.innerHTML)
  copy
    .querySelectorAll('ul.ul-free-option-none, sup')
    .forEach((n) => n.remove())
  const spans = copy.querySelectorAll('.answer-the-questions-word-free')
  const answers = spans.map((span) => [
    ...new Set(
      (span.getAttribute('text') ?? '')
        .split(' / ')
        .flatMap((a) => expandAnswer(clean(a)))
        .filter(Boolean),
    ),
  ])
  const blocks = spans.map((span) =>
    span.tagName === 'LI' ? span : (span.closest('li, td, p') ?? copy),
  )
  spans.forEach((span, i) => {
    // cả câu là một mục <li> có "_____" bên trong: chỉ thay chỗ gạch
    if (span.tagName === 'LI')
      span.set_content(span.innerHTML.replace(/_{3,}/, BLANK(i)))
    else span.replaceWith(BLANK(i))
  })
  return answers.flatMap((answer, i) => {
    const block = blocks[i]
    // xuống dòng trong mã HTML chỉ là khoảng trắng, <br> mới là xuống dòng
    const lines = parse(
      block.innerHTML.replace(/\s+/g, ' ').replace(/<br\s*\/?>/gi, '\n'),
    )
      .text.split('\n')
      .map(clean)
    let context = lines.find((l) => l.includes(BLANK(i))) ?? ''
    // đoạn văn (tóm tắt) thì lấy câu; ghi chú dạng dòng (li, ô bảng) thì cả dòng, trừ khi quá dài
    if (block.tagName === 'P' || context.length > MAX_CONTEXT)
      context =
        (context.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) ?? []).find((s) =>
          s.includes(BLANK(i)),
        ) ?? context
    // ô bảng: thêm tên hàng (ô đầu) hoặc tiêu đề trong ô để biết đang điền cho mục nào
    const cell = block.tagName === 'TD' ? block : block.closest('td')
    const head = cell?.parentNode?.querySelector('td')
    const cellTitle = cell?.querySelector('p, strong')
    const label =
      head && head !== cell
        ? clean(head.text)
        : block !== cell && cellTitle && !cellTitle.closest('li')
          ? clean(cellTitle.text)
          : ''
    const prompt = clean(
      `${label ? `${label}: ` : ''}${context.replace(BLANK(i), '___').replace(/\{\{\d+\}\}/g, '…')}`,
    )
    if (!answer.length || !prompt.includes('___')) return []
    const right = box.find((b) => comparable(b) === comparable(answer[0]))
    return right && box.length >= 3
      ? [
          {
            type: 'choice',
            prompt,
            options: box,
            answers: [right],
            ...base,
            ...extra,
          },
        ]
      : [
          {
            type: 'gap',
            prompt,
            options: [],
            answers: answer,
            ...base,
            ...extra,
          },
        ]
  })
}

/** từ nhỏ giữ chữ thường khi viết hoa tiêu đề (trừ ở đầu) */
const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'or',
  'but',
  'by',
  'with',
  'from',
  'as',
  'vs',
])

/** "CUPID AND PSYCHE" → "Cupid and Psyche" */
export const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s:(-])(\p{L}[\p{L}']*)/gu, (m, sep: string, word: string) =>
      sep && SMALL_WORDS.has(word)
        ? m
        : sep + word.charAt(0).toUpperCase() + word.slice(1),
    )

/** bài chính (h3 căn giữa đầu tiên và các đoạn sau nó) cùng câu hỏi mục Reading Comprehension và Summary */
export function parseEssentialUnit(html: string): LibraryArticle {
  const page = parse(html).querySelector('div.page-content')
  const heading = page
    ?.querySelectorAll('div > h3')
    .find((h) => /center/.test(h.getAttribute('style') ?? ''))
  if (!page || !heading?.parentNode)
    throw new Error('Không đọc được bài trên essentialenglish.review')
  const siblings = heading.parentNode.childNodes.filter(
    (n) => n instanceof HTMLElement,
  )
  const paragraphs = siblings
    .slice(siblings.indexOf(heading) + 1)
    .filter((n) => n.tagName === 'P')
    .map(textOf)
    .filter(Boolean)

  const sections = page.querySelectorAll('div.word-free-cover')
  const pick = (re: RegExp) =>
    sections.filter((s) => re.test(s.getAttribute('title') ?? ''))
  // hộp từ gợi ý của bài tóm tắt có khi nằm ngay trước khung câu hỏi
  const boxBefore = (cover: HTMLElement) => {
    const around =
      cover.parentNode?.childNodes.filter((n) => n instanceof HTMLElement) ?? []
    const prev = around
      .slice(Math.max(0, around.indexOf(cover) - 3), around.indexOf(cover))
      .reverse()
    return (
      prev
        .map((el) =>
          el.querySelectorAll('ul.ul-free-option-none li').map(textOf),
        )
        .find((b) => b.length) ?? []
    )
  }
  // hướng dẫn nhóm là phần sau "‣" trong tiêu đề khung, vd. "Mark each statement as true (T) or false (F)…"
  const instruction = (c: HTMLElement) =>
    clean((c.getAttribute('title') ?? '').split('‣')[1] ?? '') || undefined
  const questions = pick(/^(reading comprehension|summary)/i).flatMap((c) =>
    coverQuestions(c, instruction(c), boxBefore(c)),
  )
  return { title: titleCase(clean(heading.text)), paragraphs, questions }
}
