import type { ListeningLibraryItem, ListeningSection } from '#/lib/listening.ts'
import {
  BNE_BASE,
  bneCatalog,
  parseBneArticle,
} from '../reading/breaking-news.ts'

export const bneAudioUrl = (pageUrl: string) =>
  pageUrl.replace(/\.html(?:[?#].*)?$/, '.mp3')

export async function breakingNewsListeningCatalog(
  get: (url: string) => Promise<string>,
): Promise<ListeningLibraryItem[]> {
  return (await bneCatalog(get)).map((item) => ({
    ...item,
    source: 'breaking-news' as const,
  }))
}

export function parseBreakingNewsListening(
  html: string,
  url: string,
): { title: string; sections: ListeningSection[] } {
  const article = parseBneArticle(html)
  return {
    title: article.title,
    sections: [
      {
        title: article.title,
        media: { kind: 'audio', url: bneAudioUrl(url) },
        transcript: article.paragraphs,
        questions: [],
      },
    ],
  }
}

export const isBreakingNewsUrl = (url: string) => url.startsWith(BNE_BASE)
