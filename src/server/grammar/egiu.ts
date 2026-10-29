/**
 * Sách English Grammar in Use lấy từ essentialenglish.review. Repo không chứa nội dung sách:
 * lần đầu cần thì tải data.json về DATA_DIR/grammar rồi đọc từ đó (ảnh tải dần, xem grammar-media-route.ts).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { NodeType, parse } from 'node-html-parser'
import type { HTMLElement, Node } from 'node-html-parser'

import type { GrammarExercise, GrammarItem, GrammarSection, GrammarUnit, HtmlElement, HtmlNode } from '#/lib/grammar.ts'

export const EGIU_BASE = 'https://www.essentialenglish.review/apps-data/english-grammar-in-use-with-answers/'

export const grammarDir = () => path.join(path.resolve(process.env.DATA_DIR ?? 'data'), 'grammar')
export const grammarImagesDir = () => path.join(grammarDir(), 'images')

interface RawBook {
  flashcard: Array<{
    en: string
    desc: string
    reading: Array<{ type: string; en: string; story: string }>
  }>
}

const KEEP_TAGS = new Set([
  'strong', 'b', 'em', 'i', 'u', 'strike', 'sup', 'sub', 'br', 'p', 'div', 'span', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h4', 'img',
])
const TIGHT_TAGS = new Set(['table', 'thead', 'tbody', 'tr', 'ul', 'ol'])
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'])
const KEEP_ATTRS = ['class', 'colspan', 'rowspan', 'start']

/** chỗ trống trong sách: "__________" (điền) hoặc "_____" (ô Right/Wrong) */
const BLANK = /_{5,}/g

type Ctx = { items: GrammarItem[]; current: number | null; seenBlank: Set<number> }

const isAnswerEl = (el: HTMLElement) =>
  el.hasAttribute('value') || el.hasAttribute('tof') || el.hasAttribute('answer-index')

const splitAnswers = (v: string) =>
  v
    .split(' / ')
    .map((s) => s.trim())
    .filter(Boolean)

const plain = (nodes: HtmlNode[]): string =>
  nodes
    .map((n) => (typeof n === 'string' ? n : 'blank' in n ? '___' : n.tag === 'br' ? '\n' : plain(n.children)))
    .join('')

export const plainText = (nodes: HtmlNode[]) =>
  plain(nodes)
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()

function attrsOf(el: HTMLElement): Record<string, string> | undefined {
  const out: Partial<Record<string, string>> = {}
  for (const name of KEEP_ATTRS) {
    const v = el.getAttribute(name)
    if (v) out[name] = v
  }
  const style = el.getAttribute('style') ?? ''
  // khung hội thoại và đáp án mẫu chỉ được đánh dấu bằng inline style
  if (/border:/.test(style)) out.class = `${out.class ?? ''} boxed`.trim()
  else if (/border-bottom/.test(style)) out.class = `${out.class ?? ''} example-answer`.trim()
  return Object.keys(out).length ? (out as Record<string, string>) : undefined
}

function convertText(text: string, ctx: Ctx): HtmlNode[] {
  if (ctx.current == null || !/_{5,}/.test(text)) return text ? [text] : []
  const idx = ctx.current
  const item = ctx.items[idx]
  const out: HtmlNode[] = []
  let last = 0
  for (const m of text.matchAll(BLANK)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    last = m.index + m[0].length
    // Right/Wrong: ô "_____" đầu do UI tự vẽ nút chọn; trắc nghiệm: chỗ trống chỉ để minh hoạ
    if (item.kind === 'choice' || (item.kind === 'rightWrong' && m[0].length < 10)) {
      if (item.kind === 'choice') out.push('……')
      continue
    }
    if (ctx.seenBlank.has(idx)) continue
    ctx.seenBlank.add(idx)
    out.push({ blank: idx })
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function newItem(el: HTMLElement, exerciseOptions: string[]): GrammarItem {
  const base = { prompt: '' }
  if (el.hasAttribute('tof')) {
    return {
      ...base,
      kind: 'rightWrong',
      right: el.getAttribute('tof') === 'Right',
      fixes: splitAnswers(el.getAttribute('fvalue') ?? ''),
    }
  }
  if (el.hasAttribute('answer-index')) {
    const ul = el.querySelector('ul')
    return {
      ...base,
      kind: 'choice',
      options: (ul?.querySelectorAll('li') ?? []).map((li) => li.text.trim()),
      correct: (el.getAttribute('answer-index') ?? '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n)),
      multi: !!ul?.classList.contains('ul-multi-choose-answer'),
    }
  }
  // value rỗng = không điền gì (vd. bài mạo từ "the" hay "-") → đáp án "-"
  const answers = splitAnswers(el.getAttribute('value') ?? '')
  if (!answers.length) answers.push('-')
  if (el.classList.contains('answer-the-questions-section-word-blank')) {
    return { ...base, kind: 'match', options: exerciseOptions, answers }
  }
  return {
    ...base,
    kind: 'text',
    answers,
    example: false,
    long: el.classList.contains('input-free'),
  }
}

function convert(node: Node, ctx: Ctx, exerciseOptions: string[]): HtmlNode[] {
  if (node.nodeType === NodeType.TEXT_NODE) return convertText(node.text, ctx)
  if (node.nodeType !== NodeType.ELEMENT_NODE) return []
  const el = node as HTMLElement
  const tag = el.rawTagName.toLowerCase()
  if (DROP_TAGS.has(tag)) return []

  // ô input bị khoá chứa đáp án mẫu → chỗ trống đã điền sẵn
  if (tag === 'input') {
    const idx = ctx.current
    if (idx == null) return []
    const item = ctx.items[idx]
    if (item.kind === 'text') item.example = true
    if (ctx.seenBlank.has(idx)) return []
    ctx.seenBlank.add(idx)
    return [{ blank: idx }]
  }

  const outer = ctx.current
  let itemIdx: number | undefined
  if (isAnswerEl(el)) {
    itemIdx = ctx.items.push(newItem(el, exerciseOptions)) - 1
    ctx.current = itemIdx
  }
  const item = itemIdx != null ? ctx.items[itemIdx] : undefined

  const children: HtmlNode[] = []
  for (const child of el.childNodes) {
    // danh sách phương án trắc nghiệm do UI tự vẽ
    if (item?.kind === 'choice' && child.nodeType === NodeType.ELEMENT_NODE && (child as HTMLElement).rawTagName.toLowerCase() === 'ul')
      continue
    children.push(...convert(child, ctx, exerciseOptions))
  }
  ctx.current = outer

  if (item) {
    // câu điền không có ký hiệu chỗ trống → đặt ô nhập ở cuối
    if ((item.kind === 'text' || item.kind === 'match') && !ctx.seenBlank.has(itemIdx!)) {
      ctx.seenBlank.add(itemIdx!)
      children.push(' ', { blank: itemIdx! })
    }
    item.prompt = plainText(children)
  }

  if (tag === 'img') {
    const src = el.getAttribute('src') ?? ''
    const file = path.posix.basename(src)
    return /^[\w.-]+\.(jpe?g|png|gif|webp)$/i.test(file)
      ? [{ tag: 'img', attrs: { src: `/api/grammar-media/${encodeURIComponent(file)}` }, children: [] }]
      : []
  }
  if (!KEEP_TAGS.has(tag)) return children

  // <p> đổi thành <div>: sách lồng bảng/danh sách trong <p>, trình duyệt tự tách thẻ → lệch hydrate
  const name = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag === 'p' ? 'div' : tag
  const out: HtmlElement = {
    tag: name,
    // khoảng trắng giữa các thẻ bảng/danh sách không hợp lệ trong DOM
    children: TIGHT_TAGS.has(name) ? children.filter((c) => typeof c !== 'string' || c.trim()) : children,
  }
  let attrs = attrsOf(el)
  if (tag === 'p') attrs = { ...attrs, class: `${attrs?.class ?? ''} para`.trim() }
  if (attrs) out.attrs = attrs
  if (itemIdx != null) out.item = itemIdx
  return [out]
}

function toNodes(html: string): HtmlNode[] {
  const ctx: Ctx = { items: [], current: null, seenBlank: new Set() }
  return parse(html).childNodes.flatMap((n) => convert(n, ctx, []))
}

/**
 * Câu hỏi nằm giữa đoạn hội thoại (span "___") → lấy cả khối bao quanh làm ngữ cảnh,
 * chỗ trống của câu này ghi "___", chỗ trống khác ghi "…"
 */
function contextOf(body: HtmlNode[], idx: number): string | undefined {
  const render = (nodes: HtmlNode[]): string =>
    nodes
      .map((n) =>
        typeof n === 'string' ? n : 'blank' in n ? (n.blank === idx ? '___' : '…') : n.tag === 'br' ? '\n' : render(n.children),
      )
      .join('')
  const find = (nodes: HtmlNode[], parents: HtmlElement[]): HtmlElement[] | null => {
    for (const n of nodes) {
      if (typeof n === 'string' || 'blank' in n) continue
      if (n.item === idx) return [...parents, n]
      const hit = find(n.children, [...parents, n])
      if (hit) return hit
    }
    return null
  }
  const trail = find(body, [])
  // chỉ chỗ trống nằm trong câu (span); câu là cả <li> thì đã đủ ngữ cảnh
  if (trail?.at(-1)?.tag !== 'span') return undefined
  for (let i = trail.length - 2; i >= 0; i--) {
    const text = render(trail[i].children).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
    if (text.length >= 30) return text.slice(0, 1200)
  }
  return undefined
}

/** tách phần bài tập thành từng exercise theo tiêu đề <h4>"1.2 …"</h4> */
function parseExercises(html: string): GrammarExercise[] {
  const root = parse(html)
  const groups: Array<{ head: HTMLElement; nodes: Node[] }> = []
  for (const node of root.childNodes) {
    const el = node as HTMLElement
    if (node.nodeType === NodeType.ELEMENT_NODE && el.rawTagName.toLowerCase() === 'h4') groups.push({ head: el, nodes: [] })
    else if (groups.length) groups[groups.length - 1].nodes.push(node)
  }
  return groups.map(({ head, nodes }, i) => {
    const heading = head.text.replace(/\s+/g, ' ').trim()
    const m = /^(\d+\.\d+)\s*(.*)$/.exec(heading)
    const options = nodes
      .flatMap((n) => (n.nodeType === NodeType.ELEMENT_NODE ? (n as HTMLElement).querySelectorAll('#ul-free-option li') : []))
      .map((li) => li.text.trim())
    const ctx: Ctx = { items: [], current: null, seenBlank: new Set() }
    const body = nodes.flatMap((n) => convert(n, ctx, options))
    for (const [idx, item] of ctx.items.entries()) {
      if (item.prompt.length < 30) item.prompt = contextOf(body, idx) ?? item.prompt
    }
    return { key: m?.[1] ?? String(i + 1), title: m?.[2] ?? heading, body, items: ctx.items }
  })
}

export function parseBook(raw: RawBook): GrammarUnit[] {
  return raw.flashcard.flatMap((u): GrammarUnit[] => {
    const unit = /^Unit\s+(\d+)\s*:\s*(.*)$/.exec(u.en)
    const appendix = /^Appendix\s+(\d+)\s*:\s*(.*)$/.exec(u.en)
    if (!unit && !appendix) return []
    const sections: GrammarSection[] = u.reading
      .filter((r) => r.type === 'story')
      .map((r) => ({ label: r.en.trim(), body: toNodes(r.story) }))
    const exercises = u.reading.filter((r) => r.type === 'faq').flatMap((r) => parseExercises(r.story))
    return [
      {
        id: unit ? unit[1] : `appendix-${appendix![1]}`,
        order: unit ? Number(unit[1]) : 1000 + Number(appendix![1]),
        title: (unit ?? appendix)![2].replace(/\s+/g, ' ').trim(),
        group: u.desc,
        sections,
        exercises,
      },
    ]
  })
}

async function download(file: string) {
  const res = await fetch(new URL('data/data.json', EGIU_BASE), { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = (await res.text()).replace(/^\uFEFF/, '')
  JSON.parse(text) // file hỏng thì không lưu
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, text)
  return text
}

let book: Promise<GrammarUnit[]> | null = null

export function loadBook(): Promise<GrammarUnit[]> {
  book ??= (async () => {
    const file = path.join(grammarDir(), 'data.json')
    const text = await fs.readFile(file, 'utf8').catch(() =>
      download(file).catch((err: unknown) => {
        throw new Error(`Không tải được dữ liệu ngữ pháp (${err instanceof Error ? err.message : String(err)})`)
      }),
    )
    return parseBook(JSON.parse(text.replace(/^\uFEFF/, '')) as RawBook).sort((a, b) => a.order - b.order)
  })().catch((err: unknown) => {
    book = null // lỗi mạng → lần sau thử lại
    throw err
  })
  return book
}

export async function getUnit(id: string) {
  return (await loadBook()).find((u) => u.id === id)
}
