/** Câu hỏi hội thoại từ The Internet TESL Journal (iteslj.org/questions) cho dạng "Hỏi nhanh – đáp nhanh" */
import { parse } from 'node-html-parser'

import { levelByLength, wordCount } from '#/lib/reflex.ts'
import type { ReflexLevel } from '#/lib/reflex.ts'

export const ITESLJ_BASE = 'http://iteslj.org/questions/'

export interface IteslJTopic {
  slug: string
  title: string
}

/** bỏ thẻ và giải mã &amp;… */
const stripTags = (s: string) =>
  parse(s.replace(/<[^>]*>/g, ' '))
    .text.replace(/\s+/g, ' ')
    .trim()

/** mục lục chủ đề: các link "xxx.html" trong danh sách .topics-grid */
export function parseIteslJIndex(html: string): IteslJTopic[] {
  const start = html.indexOf('topics-grid">')
  const block = start >= 0 ? html.slice(start) : html
  const seen = new Set<string>()
  const topics: IteslJTopic[] = []
  for (const m of block.matchAll(
    /<a href="([a-z0-9-]+)\.html">([\s\S]*?)<\/a>/gi,
  )) {
    const slug = m[1].toLowerCase()
    if (seen.has(slug)) continue
    seen.add(slug)
    const title = stripTags(m[2])
    if (title) topics.push({ slug, title })
  }
  return topics
}

/**
 * Câu hỏi của một chủ đề: chỉ lấy <li> cấp ngoài cùng,
 * bỏ câu hỏi phụ lồng trong <ul> con (vd. "Where did you go?") vì thiếu ngữ cảnh.
 * Trang dùng <li> không đóng nên đếm độ sâu <ul> thay vì parse DOM.
 */
export function parseIteslJQuestions(html: string) {
  const out: Array<{ question: string; level: ReflexLevel }> = []
  let depth = 0
  const tokens = /<ul[^>]*>|<\/ul>|<li[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = tokens.exec(html))) {
    const tag = m[0].toLowerCase()
    if (tag.startsWith('<ul')) depth++
    else if (tag === '</ul>') depth = Math.max(0, depth - 1)
    else if (depth === 1) {
      const rest = html.slice(tokens.lastIndex)
      const end = rest.search(/<ul|<\/ul|<li/i)
      // "…landing? 5. What do you do…": trang gộp nhầm hai câu, chỉ giữ câu đầu
      const question = stripTags(end >= 0 ? rest.slice(0, end) : rest)
        .replace(/\s\d+\.\s.*$/, '')
        .trim()
      if (question.endsWith('?') && wordCount(question) >= 3)
        out.push({ question, level: levelByLength(wordCount(question)) })
    }
  }
  return out
}

export const iteslJTopicUrl = (slug: string) => `${ITESLJ_BASE}${slug}.html`
