/**
 * Đề Cambridge IELTS Academic 14–18 trên essentialenglish.review: mỗi sách 4 test × 3 bài đọc, kèm đáp án gốc.
 * Dữ liệu là data.json của app trên site: mỗi test có một khối HTML "Reading" chứa cả 3 bài và câu hỏi.
 */
import { HTMLElement, parse } from 'node-html-parser'

import type { ReadingQuestion } from '#/db/schema.ts'
import { EE_SITE, clean, coverQuestions, textOf, titleCase } from './essential.ts'
import type { LibraryArticle, LibraryItem } from './sources.ts'

export const IELTS_BOOKS = [14, 15, 16, 17, 18]
export const IELTS_BASE = `${EE_SITE}apps-data/ielts-academic-`

export const ieltsDataUrl = (book: number) => `${IELTS_BASE}${book}/data/data.json`

interface IeltsData {
  flashcard: Array<{ en: string; reading?: Array<{ en: string; story?: string }> | string | null }>
}

export function parseIeltsData(text: string): IeltsData {
  return JSON.parse(text.replace(/^\uFEFF/, '')) as IeltsData
}

/** HTML phần Reading của từng test, theo thứ tự Test 1–4 */
function readingTests(data: IeltsData) {
  return data.flashcard.flatMap((unit) => {
    const test = /^Test\s+(\d+)/i.exec(unit.en)?.[1]
    const story = Array.isArray(unit.reading) ? unit.reading.find((b) => b.en === 'Reading')?.story : undefined
    return test && story ? [{ test: Number(test), html: story }] : []
  })
}

interface Passage {
  title: string
  paragraphs: string[]
  questions: ReadingQuestion[]
}

const isQuestionsHeading = (el: HTMLElement) => el.tagName === 'P' && /^Questions\s+\d/i.test(textOf(el))
const isCover = (el: HTMLElement) => el.classList.contains('word-free-cover')

/** đoạn văn của bài: <p>, hoặc <ol> mỗi mục là một đoạn đánh chữ A, B, C…; bỏ gạch chú thích và dòng "*" */
function passageParagraphs(el: HTMLElement): string[] {
  if (el.tagName === 'OL') return el.querySelectorAll('li').map((li, i) => `${String.fromCharCode(65 + i)}. ${textOf(li)}`)
  const text = textOf(el).replace(/^_{3,}\s*/, '')
  return text && !text.startsWith('*') ? [text] : []
}

/** chữ của vùng hướng dẫn: giữ xuống dòng, danh sách phương án đánh chữ A, B…, bỏ câu nhắc ghi vào phiếu trả lời */
function instructionText(els: HTMLElement[]): string {
  return els
    .flatMap((el) => {
      if (el.tagName === 'OL' || el.tagName === 'UL')
        return el.querySelectorAll('li').map((li, i) => `${String.fromCharCode(65 + i)}  ${textOf(li)}`)
      return parse(el.innerHTML.replace(/\s+/g, ' ').replace(/<br\s*\/?>/gi, '\n')).text.split('\n')
    })
    .map((line) =>
      clean(line)
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !/answer sheet/i.test(sentence))
        .join(' '),
    )
    .filter(Boolean)
    .join('\n')
}

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'OL', 'UL', 'TABLE'])

/**
 * các khối theo thứ tự trong trang: tiêu đề "READING PASSAGE n", khung câu hỏi, đoạn, danh sách, bảng.
 * HTML gốc hay thiếu thẻ đóng </div> nên phần sau bị lồng vào khung trước: đi xuyên qua các div bọc ngoài.
 */
function blocks(node: HTMLElement): HTMLElement[] {
  return node.childNodes
    .filter((n) => n instanceof HTMLElement)
    .flatMap((el) => {
      if (el.classList.contains('section-rotate') || BLOCK_TAGS.has(el.tagName)) return [el]
      if (isCover(el)) {
        // khung câu hỏi có thể nuốt luôn phần sau nó (bài tiếp theo, nhóm câu tiếp theo)
        const inner = el.childNodes.filter((n) => n instanceof HTMLElement)
        const cut = inner.findIndex((n) => n.classList.contains('section-rotate') || isQuestionsHeading(n) || isCover(n))
        if (cut < 0) return [el]
        const rest = inner.slice(cut)
        rest.forEach((n) => n.remove())
        return [el, ...rest.flatMap((n) => (BLOCK_TAGS.has(n.tagName) || isCover(n) || n.classList.contains('section-rotate') ? [n] : blocks(n)))]
      }
      // div chỉ có chữ (vd. tiêu đề hộp "List of Timber Cuts") giữ như một đoạn
      return el.childNodes.some((n) => n instanceof HTMLElement && n.tagName !== 'STRONG' && n.tagName !== 'EM' && n.tagName !== 'BR') ? blocks(el) : [el]
    })
}

/** tách khối Reading của một test thành 3 bài: đoạn văn, rồi các nhóm "Questions x–y" (hướng dẫn + khung câu hỏi) */
export function parseIeltsTest(html: string): Passage[] {
  const nodes = blocks(parse(html))
  const passages: Array<{ nodes: HTMLElement[] }> = []
  for (const el of nodes) {
    if (el.classList.contains('section-rotate') && /reading passage/i.test(el.text)) passages.push({ nodes: [] })
    else passages.at(-1)?.nodes.push(el)
  }
  return passages.map(({ nodes: els }) => {
    const heading = els.find((el) => el.tagName === 'H3')
    const start = heading ? els.indexOf(heading) + 1 : 0
    // dạng nối tiêu đề: nhóm câu hỏi đứng trước bài → thân bài là từ sau h3 tới đoạn "Questions" kế tiếp
    const next = els.findIndex((el, i) => i >= start && isQuestionsHeading(el))
    const end = next < 0 ? els.length : next
    const body = els.slice(start, end)
    const questions: ReadingQuestion[] = []
    let pending: HTMLElement[] = []
    for (const el of [...els.slice(0, heading ? start - 1 : 0), ...els.slice(end)]) {
      if (isQuestionsHeading(el)) pending = []
      else if (isCover(el)) {
        questions.push(...coverQuestions(el, instructionText(pending) || undefined))
        pending = []
      } else pending.push(el)
    }
    const title = clean(heading?.text ?? '')
    return {
      // tiêu đề viết hoa toàn bộ thì đưa về dạng thường
      title: title === title.toUpperCase() ? titleCase(title) : title,
      paragraphs: body.flatMap(passageParagraphs),
      questions,
    }
  })
}

/** mục lục: mỗi bài đọc một mục, url là data.json kèm #t{test}p{passage} */
export function ieltsCatalog(book: number, data: IeltsData): LibraryItem[] {
  return readingTests(data).flatMap(({ test, html }) =>
    parseIeltsTest(html).map((p, i) => ({
      source: 'cambridge-ielts' as const,
      url: `${ieltsDataUrl(book)}#t${test}p${i + 1}`,
      title: p.title || `Reading Passage ${i + 1}`,
      levels: ['B2' as const, 'C1' as const],
      levelLabel: `Cambridge ${book} · Test ${test} · Passage ${i + 1}`,
    })),
  )
}

/** "…/ielts-academic-14/data/data.json#t1p2" → sách, test, bài */
export function parseIeltsUrl(url: string) {
  const m = /ielts-academic-(\d+)\/data\/data\.json#t(\d+)p(\d+)$/.exec(url)
  if (!m) throw new Error('Link đề IELTS không hợp lệ')
  return { book: Number(m[1]), test: Number(m[2]), passage: Number(m[3]) }
}

export function ieltsArticle(data: IeltsData, test: number, passage: number): LibraryArticle {
  const html = readingTests(data).find((t) => t.test === test)?.html
  const p = html ? parseIeltsTest(html)[passage - 1] : undefined
  if (!p?.paragraphs.length) throw new Error('Không tìm thấy bài đọc trong đề IELTS')
  return p
}
