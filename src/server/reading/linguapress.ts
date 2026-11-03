/**
 * Linguapress: bài viết tay HTML, mỗi bài ghi "CEF level". Mục lục lấy từ hai bảng cấp CEFR (Intermediate, Advanced).
 * Phiếu bài tập trên trang không có đáp án nên chỉ lấy phần bài đọc.
 */
import { parse } from 'node-html-parser'

import type { ReadingLevel } from '#/lib/reading-topics.ts'
import type { LibraryArticle, LibraryItem } from './sources.ts'

export const LINGUAPRESS_BASE = 'https://linguapress.com/'
export const LINGUAPRESS_INDEXES = [`${LINGUAPRESS_BASE}intermediate/grammar-exercise-index`, `${LINGUAPRESS_BASE}advanced/cefr-level-index`]

/** "B2.1" → B2, "C1 / C2" → C1, "A2 - B1" → A2, B1; A1 gộp vào A2, C2 vào C1 */
export function cefrLevels(text: string): ReadingLevel[] {
  const map: Record<string, ReadingLevel> = { A1: 'A2', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C1' }
  return [...new Set([...text.toUpperCase().matchAll(/[ABC][12]/g)].map((m) => map[m[0]]))]
}

export function parseLinguapressIndex(html: string, indexUrl: string): LibraryItem[] {
  return parse(html)
    .querySelectorAll('table.tbl1 tr')
    .flatMap((tr): LibraryItem[] => {
      const cells = tr.querySelectorAll('td')
      if (cells.length < 2) return []
      const [cell, levelCell] = cells
      const href = cell.querySelector('a')?.getAttribute('href')
      const levelText = levelCell.text.replace(/\s+/g, ' ').trim()
      const levels = cefrLevels(levelText)
      if (!href || !levels.length) return []
      const url = new URL(href, indexUrl).toString()
      // bảng có cả link bài ngữ pháp
      if (!url.startsWith(LINGUAPRESS_BASE) || url.includes('/grammar/')) return []
      return [
        {
          source: 'linguapress',
          url,
          title: cell.text.replace(/\s+/g, ' ').replace(/\s*-?\s*with audio\s*$/i, '').trim(),
          levels,
          levelLabel: levelText.replace(/\s*(\/|and|-)\s*/g, '–'),
        },
      ]
    })
}

export function linguapressCatalog(items: LibraryItem[][]): LibraryItem[] {
  const seen = new Set<string>()
  return items.flat().filter((i) => !seen.has(i.url) && !!seen.add(i.url))
}

/** hết bài đọc: bảng từ, phiếu bài tập, bản quyền, link điều hướng */
const STOP =
  /^(©|pronunciation\s*:|difficult words\b|word guide\b|words\s*:\s*$|words\s*:\s*\S+\s*(\[|:|-)|vocabulary( guide)?\s*:?\s*$|copyright|students?'? worksheet|worksheet|exercises?\b|return to|printing:|optimized for printing|for teachers|►►►|read more|discover more|more (american|british)|this resource|missing words - answers)/i
/** tiêu đề bảng từ viết hoa "WORDS" (chữ "Words: click…" ở đầu bài là hướng dẫn, bỏ qua) */
const WORDS_HEADING = /^WORDS\b/
/** dòng hướng dẫn, nhãn trang */
const SKIP =
  /^(►|words\s*:?\s*(click|hover)|words in (red|purple)|click here to open vocabulary|with interactive worksheet|linguapress (elementary|intermediate|advanced)( english)?$|with audio|now with audio|click to open\/close audio player|audio player|for vocabulary guide|[-.:\s]*$|an? (intermediate|advanced|elementary) level english resource|.*\bielts reading practice test\b|(an? )?(elementary|preliminary|intermediate|advanced|[abc][12])\b[\w\s/-]{0,30}\benglish( dialogue| resource)?\.?$)/i

/** dòng ngắn không phải câu (nhãn chuyên mục, chú thích ảnh) trước đoạn văn đầu tiên */
const isKicker = (p: string) => p.split(' ').length < 8 && !/[.?!"”]$/.test(p)

export function parseLinguapressArticle(html: string): LibraryArticle {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false } })
  // bài dạng điền chỗ trống: chữ bị khoét lỗ, không đọc được
  if (root.querySelector('textarea.ibox')) throw new Error('Bài này là bài điền từ vào chỗ trống, hãy chọn bài khác')
  const main = root.querySelector('.middle') ?? root
  // .bublup là ô giải nghĩa bật lên trong bài (chữ chính nằm ngoài)
  for (const sel of ['.bublup', '.laa', '.shbt', '.breadcrumb', '#mplay', 'audio', 'img', '.res2', '.footer', '#eucookielaw', '.mnu', 'textarea', 'select', 'input', 'form', 'table'])
    main.querySelectorAll(sel).forEach((n) => n.remove())
  const h1 = root.querySelector('h1')
  const title = (h1?.text ?? root.querySelector('title')?.text ?? '').replace(/\s+/g, ' ').trim()

  let body = main.innerHTML
  if (h1) {
    const at = body.indexOf(h1.outerHTML)
    if (at >= 0) body = body.slice(at + h1.outerHTML.length)
  }
  body = body
    .replace(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi, '\n\n$2\n\n')
    .replace(/<\/?(p|div|li|ul|ol|hr|br)\b[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
  const paragraphs: string[] = []
  for (const raw of parse(`<x>${body}</x>`).text.split(/\n\s*\n/)) {
    const p = raw.replace(/\s+/g, ' ').trim()
    if (!p) continue
    if (STOP.test(p) || WORDS_HEADING.test(p)) break
    if (SKIP.test(p) || (!paragraphs.length && isKicker(p))) continue
    paragraphs.push(p)
  }
  if (!title || !paragraphs.length) throw new Error('Không đọc được bài trên Linguapress')
  return { title, paragraphs }
}
