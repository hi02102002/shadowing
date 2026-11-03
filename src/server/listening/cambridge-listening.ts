import { parse } from 'node-html-parser'

import type { ListeningLibraryItem, ListeningSection } from '#/lib/listening.ts'
import { clean, coverQuestions } from '../reading/essential.ts'
import {
  essentialDataUrl,
  loadEssentialApp,
} from '../reading/essential-apps.ts'

export const CAMBRIDGE_LISTENING_BOOKS = [14, 15, 16, 17, 18] as const

function listeningTests(data: Awaited<ReturnType<typeof loadEssentialApp>>) {
  return data.flashcard.flatMap((unit) => {
    const test = /^Test\s+(\d+)/i.exec(String(unit.en ?? ''))?.[1]
    const reading = Array.isArray(unit.reading) ? unit.reading : []
    const block = reading.find(
      (x) =>
        x &&
        typeof x === 'object' &&
        /^listening$/i.test(String((x as Record<string, unknown>).en ?? '')),
    ) as Record<string, unknown> | undefined
    const html = typeof block?.story === 'string' ? block.story : undefined
    return test && html ? [{ test: Number(test), html }] : []
  })
}

/** Thay phần gạch chân trong script bằng [[đáp án]] để giao diện tô sau khi nộp. */
function transcript(html: string): string[] | null {
  const root = parse(html)
  const script = root.querySelector('div.script')
  if (!script) return null
  script
    .querySelectorAll('u')
    .forEach((u) => u.replaceWith(`[[${clean(u.text)}]]`))
  const rows = script
    .querySelectorAll('tr')
    .map((row) => clean(row.text))
    .filter(Boolean)
  if (rows.length) return rows
  return script
    .querySelectorAll('p')
    .map((p) => clean(p.text))
    .filter(Boolean)
}

/** Tách HTML Listening thành các section theo khung SECTION n. */
export function parseCambridgeListening(
  html: string,
  pageUrl: string,
): ListeningSection[] {
  const starts = [
    ...html.matchAll(
      /<[^>]*class=["'][^"']*section-rotate[^"']*["'][^>]*>\s*(?:SECTION|PART)\s+(\d+)[\s\S]*?<\/[^>]+>/gi,
    ),
  ]
  return starts.map((match, index) => {
    const part = html.slice(
      match.index,
      starts[index + 1]?.index ?? html.length,
    )
    const root = parse(part)
    const speaker = root.querySelector('img.speaker-louder')
    const source =
      speaker?.getAttribute('source') ??
      speaker?.getAttribute('data-source') ??
      speaker?.getAttribute('src')
    const media = source
      ? { kind: 'audio' as const, url: new URL(source, pageUrl).toString() }
      : null
    const questions = root
      .querySelectorAll('div.word-free-cover')
      .flatMap((cover) => {
        const instruction =
          clean(cover.getAttribute('title') ?? '')
            .split('‣')
            .at(-1) || undefined
        return coverQuestions(cover, instruction)
      })
    return {
      title: `Section ${match[1]}`,
      media,
      transcript: transcript(part),
      questions,
    }
  })
}

export async function cambridgeListeningCatalog(): Promise<
  ListeningLibraryItem[]
> {
  return (
    await Promise.all(
      CAMBRIDGE_LISTENING_BOOKS.map(async (book) => {
        const slug = `ielts-academic-${book}`
        const data = await loadEssentialApp(slug)
        return listeningTests(data).map(({ test }) => ({
          source: 'cambridge-listening' as const,
          url: `${essentialDataUrl(slug)}#t${test}`,
          title: `Cambridge IELTS ${book} · Test ${test}`,
          levels: ['B2' as const, 'C1' as const],
          levelLabel: `Cambridge ${book} · IELTS`,
        }))
      }),
    )
  ).flat()
}

export async function fetchCambridgeListening(url: string) {
  const m = /ielts-academic-(\d+)\/data\/data\.json#t(\d+)$/.exec(url)
  if (!m || !CAMBRIDGE_LISTENING_BOOKS.includes(Number(m[1]) as never))
    throw new Error('Link đề IELTS Listening không hợp lệ')
  const data = await loadEssentialApp(`ielts-academic-${m[1]}`)
  const test = listeningTests(data).find((x) => x.test === Number(m[2]))
  if (!test) throw new Error('Không tìm thấy phần Listening trong đề')
  const sections = parseCambridgeListening(
    test.html,
    url.split('/data/')[0] + '/',
  )
  if (sections.length !== 4)
    throw new Error(
      `Đề Listening phải có 4 section, hiện đọc được ${sections.length}`,
    )
  return { title: `Cambridge IELTS ${m[1]} · Test ${m[2]}`, sections }
}
