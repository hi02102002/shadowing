/** Breaking News English: mỗi tin viết lại ở Level 0–6, mục lục theo từng level, bài là HTML tĩnh */
import { parse } from 'node-html-parser'

import type { ReadingLevel } from '#/lib/reading-topics.ts'
import type { LibraryArticle, LibraryItem } from './sources.ts'

export const BNE_BASE = 'https://breakingnewsenglish.com/'

/** trang mục lục của từng level (tới 2014) và cấp CEFR tương ứng theo news_levels.html */
const BNE_LEVELS: Array<{ page: string; label: string; levels: ReadingLevel[] }> = [
  { page: 'easy-news-english.html', label: 'Level 0 · A2', levels: ['A2'] },
  { page: 'simple-english-news.html', label: 'Level 1 · A2', levels: ['A2'] },
  { page: 'easy-english-news.html', label: 'Level 2 · A2', levels: ['A2'] },
  { page: 'graded-news-stories.html', label: 'Level 3 · A2–B1', levels: ['A2', 'B1'] },
  { page: 'graded-news-articles.html', label: 'Level 4 · B1–B2', levels: ['B1', 'B2'] },
  { page: 'english-news-readings.html', label: 'Level 5 · B2', levels: ['B2'] },
  { page: 'news-for-kids.html', label: 'Level 6 · C1', levels: ['C1'] },
]

/** mỗi level chỉ lấy các tin mới nhất */
const PER_LEVEL = 150

const ENTRY = /<li><tt>(\d{4}-\d{2}-\d{2}): <\/tt><a [^>]*href="([^"]+)">([^<]+)<\/a>/g

const decode = (s: string) => parse(`<x>${s}</x>`).text.replace(/\s+/g, ' ').trim()

export function parseBneIndex(html: string, level: number): LibraryItem[] {
  const info = BNE_LEVELS[level]
  return [...html.matchAll(ENTRY)].slice(0, PER_LEVEL).map((m) => ({
    source: 'breaking-news',
    url: new URL(m[2], BNE_BASE).toString(),
    title: decode(m[3]),
    levels: info.levels,
    levelLabel: info.label,
    date: m[1],
  }))
}

export async function bneCatalog(get: (url: string) => Promise<string>): Promise<LibraryItem[]> {
  const pages = await Promise.all(BNE_LEVELS.map((l, i) => get(BNE_BASE + l.page).then((html) => parseBneIndex(html, i))))
  return pages.flat().sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

/** tiêu đề ở header h3 đầu tiên (bỏ ngày), bài nằm trong <article> duy nhất, các đoạn cách nhau bằng <br><br> */
export function parseBneArticle(html: string): LibraryArticle {
  const root = parse(html)
  const h3 = root.querySelector('header h3')
  h3?.querySelectorAll('.font_small').forEach((n) => n.remove())
  const article = root.querySelector('article')
  if (!h3 || !article) throw new Error('Không đọc được bài trên Breaking News English')
  const paragraphs = article.innerHTML
    .split(/<br\s*\/?>\s*<br\s*\/?>/i)
    .map((p) => decode(p.replace(/<[^>]+>/g, '')))
    .filter(Boolean)
  return { title: decode(h3.text), paragraphs }
}
