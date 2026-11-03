/**
 * OneStopEnglish corpus (CC BY-SA 4.0, Vajjala & Lučić 2018): 189 bài, mỗi bài 3 mức, file .txt mỗi dòng một đoạn.
 * Tên file là tiêu đề (dòng đầu là câu mở bài, không phải tiêu đề).
 */
import type { ReadingLevel } from '#/lib/reading-topics.ts'
import type { LibraryArticle, LibraryItem } from './sources.ts'

const REPO = 'nishkalavallabhi/OneStopEnglishCorpus'
export const ONESTOP_RAW = `https://raw.githubusercontent.com/${REPO}/master/`
export const ONESTOP_TREE = `https://api.github.com/repos/${REPO}/git/trees/master?recursive=1`

// Int-Txt/*.txt ngoài cùng là bản hỏng (mất hết ký tự ngoài ASCII), bản sạch nằm trong Int-Txt/Int-Txt/
const LEVEL_DIRS: Array<{ dir: string; suffix: string; label: string; levels: ReadingLevel[] }> = [
  { dir: 'Texts-SeparatedByReadingLevel/Ele-Txt/', suffix: '-ele.txt', label: 'Elementary · A2', levels: ['A2'] },
  { dir: 'Texts-SeparatedByReadingLevel/Int-Txt/Int-Txt/', suffix: '-int.txt', label: 'Intermediate · B1', levels: ['B1'] },
  { dir: 'Texts-SeparatedByReadingLevel/Adv-Txt/', suffix: '-adv.txt', label: 'Advanced · B2–C1', levels: ['B2', 'C1'] },
]

/** tên file → tiêu đề: bỏ hậu tố mức độ, tiền tố "WNL" (World News Lessons) */
export const onestopTitle = (file: string) =>
  file
    .replace(/\s*-(ele|int|adv)\.txt$/, '')
    .replace(/^WNL\s+/, '')
    .trim()

/** danh sách file từ git tree API của GitHub */
export function parseOnestopTree(tree: { tree: Array<{ path: string; type: string }> }): LibraryItem[] {
  return LEVEL_DIRS.flatMap((l) =>
    tree.tree
      .filter((f) => f.type === 'blob' && f.path.startsWith(l.dir) && !f.path.slice(l.dir.length).includes('/') && f.path.endsWith(l.suffix))
      .map((f) => ({
        source: 'onestop' as const,
        url: ONESTOP_RAW + f.path.split('/').map(encodeURIComponent).join('/'),
        title: onestopTitle(f.path.slice(l.dir.length)),
        levels: l.levels,
        levelLabel: l.label,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  )
}

/** UTF-8 (thường có BOM), vài file là cp1252; chữ ghép kiểu PDF (ﬁ, ﬂ) đưa về dạng thường */
export function decodeOnestop(bytes: ArrayBuffer): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes)
  }
  return text.replace(/^\uFEFF/, '').normalize('NFKC').replace(/\uFFFD/g, '')
}

export function parseOnestopText(text: string, url: string): LibraryArticle {
  const file = decodeURIComponent(url.split('/').at(-1) ?? '')
  const paragraphs = text
    .split(/\r?\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    // bản cũ có dòng tiêu đề mức độ ở đầu
    .filter((p) => p && !/^(elementary|intermediate|advanced)$/i.test(p))
  return { title: onestopTitle(file), paragraphs }
}
