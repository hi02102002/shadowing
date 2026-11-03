import { parse } from 'node-html-parser'

import type { ListeningLibraryItem, ListeningSection } from '#/lib/listening.ts'

/** API công khai mà trang blog dùng để lật trang. */
export const EE_BLOG_BASE = 'https://www.essentialenglish.review/'
export const EE_BLOG_API = `${EE_BLOG_BASE}api/news/getpaged`

type BlogJson = Record<string, unknown>

function records(value: unknown): BlogJson[] {
  if (Array.isArray(value))
    return value.filter((x): x is BlogJson => !!x && typeof x === 'object')
  if (!value || typeof value !== 'object') return []
  const obj = value as BlogJson
  for (const key of ['data', 'items', 'posts', 'result']) {
    const found = records(obj[key])
    if (found.length) return found
  }
  return []
}

export function parseEeBlogList(json: unknown): ListeningLibraryItem[] {
  return records(json).flatMap((row) => {
    const raw = row.url ?? row.link ?? row.slug ?? row.UrlFriendly
    const title = String(row.title ?? row.name ?? row.Title ?? '')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (!raw || !title) return []
    const path = row.UrlFriendly ? `/blog/${String(raw)}/` : String(raw)
    const url = new URL(path, EE_BLOG_BASE).toString()
    const level = /\b(A1|A2|B1|B2|C1)\b/i
      .exec(
        String(row.level ?? row.category ?? row.tags ?? row.JsonObjects ?? ''),
      )?.[1]
      ?.toUpperCase()
    return [
      {
        source: 'ee-blog',
        url,
        title,
        levels: level
          ? [level as ListeningLibraryItem['levels'][number]]
          : ['A2', 'B1'],
        levelLabel: level ? `English Blog · ${level}` : 'English Blog',
        date: String(row.PublishedOnDate ?? row.publishedAt ?? ''),
      },
    ]
  })
}

export function parseEeBlogArticle(
  html: string,
  pageUrl: string,
): { title: string; sections: ListeningSection[] } {
  const root = parse(html)
  const page =
    root.querySelector('div.page-content') ?? root.querySelector('article')
  const audio =
    root.querySelector('audio source')?.getAttribute('src') ??
    root.querySelector('audio')?.getAttribute('src')
  if (!page || !audio)
    throw new Error('Bài blog này không có đủ audio và lời thoại')
  const title = (
    root.querySelector('h1')?.text ??
    root.querySelector('title')?.text ??
    'English Listening'
  )
    .replace(/\s+/g, ' ')
    .trim()
  const transcript = page
    .querySelectorAll('p')
    .map((p) => p.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return {
    title,
    sections: [
      {
        title,
        media: {
          kind: 'audio',
          url: new URL(audio.replace(/ /g, '%20'), pageUrl).toString(),
        },
        transcript,
        questions: [],
      },
    ],
  }
}
