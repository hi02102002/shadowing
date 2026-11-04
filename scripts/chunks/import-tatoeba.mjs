import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  LEVEL_ORDER,
  LEVEL_RANK,
  classifyLevel,
  forEachTatoebaLink,
  isSuitableEnglish,
  loadVocabulary,
  parseArgs,
  readTatoebaSentences,
  requireFiles,
  topicFor,
} from './lib.mjs'

const ROOT = process.cwd()
const OUTPUT = path.join(
  ROOT,
  'src/chunks-data/sources/tatoeba-en-vi.source.jsonl',
)

const args = parseArgs()
const paths = {
  english: args.get('--english') ?? '/tmp/tatoeba-eng.tsv.bz2',
  vietnamese: args.get('--vietnamese') ?? '/tmp/tatoeba-vie.tsv.bz2',
  links: args.get('--links') ?? '/tmp/tatoeba-links.tar.bz2',
  cefr: args.get('--cefr') ?? '/tmp/cefrj-vocab.csv',
  octanove: args.get('--octanove') ?? '/tmp/octanove.csv',
}
requireFiles(paths)

const vocabulary = loadVocabulary(paths.cefr, paths.octanove)
const vietnamese = await readTatoebaSentences(paths.vietnamese, 'vie')
const english = await readTatoebaSentences(
  paths.english,
  'eng',
  (text) => isSuitableEnglish(text) && classifyLevel(vocabulary, text),
)

const pairs = []
const seen = new Set()
await forEachTatoebaLink(
  paths.links,
  english,
  vietnamese,
  (englishId, vietnameseId) => {
    const en = english.get(englishId)
    const vi = vietnamese.get(vietnameseId)
    const key = `${en.text.normalize('NFKC').toLowerCase()}|${vi.text.normalize('NFKC').toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    pairs.push({
      text: en.text,
      sense: vi.text,
      level: en.level,
      topic: topicFor(en.text),
      kind:
        en.text.endsWith('?') || en.text.split(/\s+/).length <= 5
          ? 'formula'
          : 'sentence-frame',
      frequency: 0,
      meaningVi: vi.text,
      exampleEn: en.text,
      exampleVi: vi.text,
      audioUrl: null,
      sourceVerified: true,
      reviewed: false,
      source: {
        englishId,
        englishAuthor: en.author,
        vietnameseId,
        vietnameseAuthor: vi.author,
        levelSource: en.profile,
        levelHeadwords: en.matched,
      },
    })
  },
)

pairs.sort(
  (a, b) =>
    LEVEL_RANK.get(a.level) - LEVEL_RANK.get(b.level) ||
    a.text.localeCompare(b.text) ||
    a.sense.localeCompare(b.sense, 'vi'),
)

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(
  OUTPUT,
  `${pairs.map((row) => JSON.stringify(row)).join('\n')}\n`,
)

const counts = Object.fromEntries(
  LEVEL_ORDER.map((level) => [
    level,
    pairs.filter((pair) => pair.level === level).length,
  ]),
)
console.log(`Đã nhập ${pairs.length} cặp Tatoeba Anh–Việt`, counts)
