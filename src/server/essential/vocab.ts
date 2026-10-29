/**
 * Sách từ vựng của essentialenglish.review. Giống egiu.ts, repo không chứa nội dung sách:
 * lần đầu cần thì tải data.json về DATA_DIR/essential/<slug>, ảnh/audio tải dần qua essential-media-route.ts.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'node-html-parser'

import { cleanField } from '../anki/apkg.ts'
import { EE_BASE, findBook } from './books.ts'
import type { VocabBook } from './books.ts'

export const essentialDir = () => path.join(path.resolve(process.env.DATA_DIR ?? 'data'), 'essential')

interface RawWord {
  en?: string
  pron?: string
  desc?: string
  exam?: string
  image?: string
  sound?: string
}

interface RawUnit {
  en: string
  wordlist?: RawWord[] | null
  /** wordlist: mảng bài đọc; html: HTML chứa danh sách từ */
  reading?: Array<{ story?: string }> | string | null
}

export interface RawBook {
  flashcard: RawUnit[]
}

export interface VocabWord {
  word: string
  ipa: string | null
  pos: string | null
  definition: string
  example: string | null
  imageUrl: string | null
  audioUrl: string | null
  /** id ổn định để import lại không bị trùng thẻ */
  guid: string
}

export interface VocabUnit {
  /** vị trí unit trong data.json */
  index: number
  title: string
  words: VocabWord[]
}

/** chuyển chuỗi thành đoạn URL giống hàm urlFriendlyFull của site (tên thư mục ảnh/audio) */
export function urlFriendlyFull(s: string) {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[+~`!@#$%^&();:"<>,’.?/“”…´*'\n]/g, '')
    .replace(/ +/g, '-')
    .replace(/-+/g, '-')
  return t.endsWith('-') ? t.slice(0, -1) : t
}

/** dir '_' = data/wordlist (2nd Edition), còn lại data/<dir>/wordlist */
export const mediaUrl = (slug: string, dir: string, file: string) =>
  `/api/essential-media/${slug}/${dir}/${encodeURIComponent(file)}`

const text = (html: string | undefined) => cleanField(html ?? '').text

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:!?…]+|[\s.,;:!?…]+$/g, '')

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * câu ví dụ lấy từ bài đọc của unit (English Vocabulary in Use không có câu ví dụ riêng):
 * ưu tiên câu có đúng từ đó in đậm, không có thì câu đầu tiên chứa từ
 */
function readingExamples(reading: RawUnit['reading']) {
  const bold = new Map<string, string>()
  const sentences: string[] = []
  if (Array.isArray(reading)) {
    for (const r of reading) {
      const root = parse(r.story ?? '')
      for (const block of root.querySelectorAll('li, p, td')) {
        const sentence = text(block.innerHTML)
        if (sentence && sentence.length <= 300) sentences.push(sentence)
      }
      for (const strong of root.querySelectorAll('strong')) {
        const key = normalize(strong.text)
        const block = strong.closest('li, p, td')
        if (!key || !block || bold.has(key)) continue
        const sentence = text(block.innerHTML)
        if (sentence && sentence.length <= 300) bold.set(key, sentence)
      }
    }
  }
  return (word: string) => {
    const key = normalize(word)
    const re = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'i')
    return bold.get(key) ?? sentences.find((s) => re.test(s)) ?? null
  }
}

function parseWordlistUnit(book: VocabBook, u: RawUnit, index: number): VocabUnit {
  const dir = urlFriendlyFull(u.en)
  let fromReading: ((word: string) => string | null) | undefined
  const words = (u.wordlist ?? []).flatMap((w): VocabWord[] => {
    // Verbal Advantage: "Word 1: Paraphrase"
    const word = text(w.en).replace(/^Word\s+\d+\s*:\s*/i, '')
    if (!word) return []
    // "[əˈfreid] adj." → IPA + từ loại
    const pron = /^\s*\[([^\]]*)\]\s*(.*)$/.exec(w.pron ?? '')
    let example = text(w.exam) || null
    if (!example) {
      fromReading ??= readingExamples(u.reading)
      example = fromReading(word)
    }
    return [
      {
        word,
        ipa: (pron ? pron[1] : w.pron)?.trim() || null,
        pos: pron?.[2].trim() || null,
        definition: text(w.desc),
        example,
        imageUrl: book.images && w.image ? mediaUrl(book.slug, dir, w.image) : null,
        audioUrl: w.sound ? mediaUrl(book.slug, dir, w.sound) : null,
        // English Vocabulary in Use có vài từ dùng chung id ảnh → ghép thêm từ
        guid: `ee:${book.slug}:${w.sound || w.image || index}:${word.toLowerCase()}`,
      },
    ]
  })
  return { index, title: u.en.trim(), words }
}

function parseHtmlUnit(book: VocabBook, u: RawUnit, index: number): VocabUnit {
  const root = parse(typeof u.reading === 'string' ? u.reading : '')
  const words = root.querySelectorAll('li[word]').flatMap((li): VocabWord[] => {
    const word = li.getAttribute('word')?.trim()
    if (!word) return []
    // <div><em>v.</em> định nghĩa</div><div>câu ví dụ</div>
    const [def, exam] = li.querySelectorAll('div')
    const img = li.getAttribute('img')?.trim()
    return [
      {
        word,
        ipa: li.getAttribute('pro')?.trim() || null,
        pos: def?.querySelector('em')?.text.trim() || null,
        definition: text(def?.innerHTML.replace(/<em>[\s\S]*?<\/em>/, '')),
        example: text(exam?.innerHTML) || null,
        imageUrl: book.images && img ? mediaUrl(book.slug, '_', img) : null,
        audioUrl: mediaUrl(book.slug, '_', `${urlFriendlyFull(word)}.mp3`),
        guid: `ee:${book.slug}:${word.toLowerCase()}`,
      },
    ]
  })
  return { index, title: u.en.trim(), words }
}

/** các unit có từ (bỏ Index, Appendix, bài đọc thêm…) */
export function parseBook(book: VocabBook, raw: RawBook): VocabUnit[] {
  return raw.flashcard
    .map((u, i) => (book.format === 'html' ? parseHtmlUnit(book, u, i) : parseWordlistUnit(book, u, i)))
    .filter((u) => u.words.length > 0)
}

async function download(book: VocabBook, file: string) {
  const res = await fetch(new URL(`${book.dataSlug ?? book.slug}/data/data.json`, EE_BASE), {
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = (await res.text()).replace(/^﻿/, '')
  JSON.parse(text) // file hỏng thì không lưu
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, text)
  return text
}

const books = new Map<string, Promise<VocabUnit[]>>()

export function loadBook(slug: string): Promise<VocabUnit[]> {
  const book = findBook(slug)
  if (!book) return Promise.reject(new Error('Không có sách từ vựng này'))
  let units = books.get(slug)
  if (!units) {
    units = (async () => {
      const file = path.join(essentialDir(), slug, 'data.json')
      const text = await fs.readFile(file, 'utf8').catch(() =>
        download(book, file).catch((err: unknown) => {
          throw new Error(`Không tải được sách ${book.title} (${err instanceof Error ? err.message : String(err)})`)
        }),
      )
      return parseBook(book, JSON.parse(text.replace(/^﻿/, '')) as RawBook)
    })().catch((err: unknown) => {
      books.delete(slug) // lỗi mạng → lần sau thử lại
      throw err
    })
    books.set(slug, units)
  }
  return units
}
