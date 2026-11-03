import { parse } from 'node-html-parser'

import type { ListeningLibraryItem, ListeningSection } from '#/lib/listening.ts'
import { clean, coverQuestions } from '../reading/essential.ts'
import {
  essentialDataUrl,
  loadEssentialApp,
} from '../reading/essential-apps.ts'

export const TACTICS_APPS = [
  {
    slug: 'basic-tactics-for-listening-3rd-edition',
    label: 'Basic Tactics',
    levels: ['A1', 'A2'] as const,
  },
  {
    slug: 'developing-tactics-for-listening-3rd-edition',
    label: 'Developing Tactics',
    levels: ['A2', 'B1'] as const,
  },
  {
    slug: 'expanding-tactics-for-listening-3rd-edition',
    label: 'Expanding Tactics',
    levels: ['B1', 'B2'] as const,
  },
] as const

function htmlOf(unit: Record<string, unknown>): string {
  const strings: string[] = []
  const walk = (value: unknown) => {
    if (
      typeof value === 'string' &&
      /speaker-louder|word-free-cover/.test(value)
    )
      strings.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object')
      Object.values(value).forEach(walk)
  }
  walk(unit)
  return strings.join('\n')
}

export function parseTacticsUnit(
  html: string,
  pageUrl: string,
): ListeningSection[] {
  const tracks = [
    ...html.matchAll(
      /<img\b[^>]*class=["'][^"']*speaker-louder[^"']*["'][^>]*>/gi,
    ),
  ]
  return tracks.flatMap((track, index): ListeningSection[] => {
    const chunk = html.slice(
      index ? tracks[index - 1].index + tracks[index - 1][0].length : 0,
      track.index,
    )
    const img = parse(track[0]).querySelector('img')
    const source =
      img?.getAttribute('source') ??
      img?.getAttribute('data-source') ??
      img?.getAttribute('src')
    if (!source) return []
    const root = parse(chunk)
    const questions = root
      .querySelectorAll('div.word-free-cover')
      .flatMap((cover) => {
        let parent = cover.parentNode
        let insideVisualQuestion = false
        while (parent && parent !== root) {
          if (
            'classList' in parent &&
            parent.classList.contains('word-free-cover') &&
            parent.querySelector('img')
          ) {
            insideVisualQuestion = true
            break
          }
          parent = parent.parentNode
        }
        if (
          insideVisualQuestion ||
          cover.querySelector('img') ||
          cover.querySelector('.answer-the-questions-textarea')
        )
          return []
        const instruction =
          clean(cover.getAttribute('title') ?? '')
            .split('‣')
            .at(-1) || undefined
        return coverQuestions(cover, instruction)
      })
    return [
      {
        title: `Track ${index + 1}`,
        media: { kind: 'audio', url: new URL(source, pageUrl).toString() },
        transcript: null,
        questions,
      },
    ]
  })
}

export async function tacticsCatalog(): Promise<ListeningLibraryItem[]> {
  return (
    await Promise.all(
      TACTICS_APPS.map(async (app) => {
        const data = await loadEssentialApp(app.slug)
        return data.flashcard.flatMap((unit, i) =>
          /^Unit\s+\d+\s*:/i.test(String(unit.en ?? ''))
            ? [
                {
                  source: 'tactics' as const,
                  url: `${essentialDataUrl(app.slug)}#u${i}`,
                  title: clean(String(unit.en)),
                  levels: [...app.levels],
                  levelLabel: app.label,
                },
              ]
            : [],
        )
      }),
    )
  ).flat()
}

export async function fetchTactics(url: string) {
  const m = /apps-data\/([^/]+)\/data\/data\.json#u(\d+)$/.exec(url)
  const app = TACTICS_APPS.find((x) => x.slug === m?.[1])
  if (!m || !app) throw new Error('Link Tactics for Listening không hợp lệ')
  const unit = (await loadEssentialApp(app.slug)).flashcard.at(Number(m[2]))
  if (!unit) throw new Error('Không tìm thấy unit Tactics')
  const sections = parseTacticsUnit(htmlOf(unit), url.split('/data/')[0] + '/')
  if (!sections.length) throw new Error('Unit này không có track nghe')
  return {
    title: clean(String(unit.en ?? `Unit ${Number(m[2]) + 1}`)),
    sections,
  }
}
