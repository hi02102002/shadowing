/**
 * Cụm từ (chunk ngắn) từ nguồn mở, ví dụ Anh–Việt lấy nguyên văn từ Tatoeba:
 *  - Open English WordNet (CC BY 4.0): phrasal verb, collocation, từ nối nhiều từ + định nghĩa tiếng Anh;
 *  - khung câu đầu câu (n-gram 3–4 từ) đếm tần suất trên toàn bộ câu tiếng Anh Tatoeba.
 * Không có câu hay bản dịch tự biên soạn: chunk không có nghĩa tiếng Việt riêng, tiếng Việt nằm ở câu ví dụ.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  LEVEL_ORDER,
  LEVEL_RANK,
  classifyLevel,
  commandLines,
  englishTokens,
  forEachTatoebaLink,
  isSuitableEnglish,
  loadVocabulary,
  parseArgs,
  readTatoebaSentences,
  requireFiles,
  topicFor,
  verbForms,
} from './lib.mjs'

const ROOT = process.cwd()
const OUTPUT = path.join(ROOT, 'src/chunks-data/sources/phrases.source.jsonl')

const args = parseArgs()
const paths = {
  english: args.get('--english') ?? '/tmp/tatoeba-eng.tsv.bz2',
  vietnamese: args.get('--vietnamese') ?? '/tmp/tatoeba-vie.tsv.bz2',
  links: args.get('--links') ?? '/tmp/tatoeba-links.tar.bz2',
  cefr: args.get('--cefr') ?? '/tmp/cefrj-vocab.csv',
  octanove: args.get('--octanove') ?? '/tmp/octanove.csv',
  oewn: args.get('--oewn') ?? '/tmp/oewn-2025-json',
}
requireFiles(paths)

/** khung câu: số lần đứng đầu câu tối thiểu trong toàn bộ câu tiếng Anh Tatoeba */
const MIN_FRAME_COUNT = Number(args.get('--min-frame') ?? 150)
const MAX_EXAMPLES = 3
/** cụm quá hiếm trong toàn bộ câu Tatoeba thì bỏ */
const MIN_PHRASE_COUNT = 3
/**
 * động từ 2 từ + giới từ ("live in", "go to") hầu hết khớp ví dụ theo nghĩa đen, lệch với nghĩa thành ngữ của WordNet;
 * chỉ giữ tiểu từ trạng từ (give up, find out…) hoặc cụm 3 từ trở lên (keep an eye on).
 */
const LITERAL_PREPOSITIONS = new Set([
  'about',
  'across',
  'at',
  'by',
  'for',
  'in',
  'into',
  'of',
  'on',
  'to',
  'with',
])
const FUNCTION_OBJECTS = new Set([
  'it',
  'that',
  'this',
  'these',
  'those',
  'them',
  'him',
  'her',
  'me',
  'us',
])
const PARTICLES = new Set([
  'about',
  'across',
  'along',
  'around',
  'away',
  'back',
  'by',
  'down',
  'in',
  'into',
  'off',
  'on',
  'out',
  'over',
  'through',
  'up',
])
const FRAME_BAD_END = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
])
const vocabulary = loadVocabulary(paths.cefr, paths.octanove)

function levelOf(tokens) {
  const result = classifyLevel(vocabulary, tokens.join(' '), {
    minWords: 1,
    maxWords: 40,
  })
  return result
}

/* ---------- 1. câu ví dụ Anh–Việt ---------- */

const vietnamese = await readTatoebaSentences(paths.vietnamese, 'vie')
const pairedEnglish = await readTatoebaSentences(
  paths.english,
  'eng',
  (text) => {
    if (!isSuitableEnglish(text)) return null
    const tokens = englishTokens(text)
    if (tokens.length < 3 || tokens.length > 20) return null
    return { tokens }
  },
)

const examples = []
{
  const seen = new Set()
  await forEachTatoebaLink(
    paths.links,
    pairedEnglish,
    vietnamese,
    (englishId, vietnameseId) => {
      const en = pairedEnglish.get(englishId)
      const vi = vietnamese.get(vietnameseId)
      if (seen.has(en.text)) return
      seen.add(en.text)
      examples.push({
        en: en.text,
        vi: vi.text,
        enId: englishId,
        enAuthor: en.author,
        viId: vietnameseId,
        viAuthor: vi.author,
        tokens: en.tokens,
        level: classifyLevel(vocabulary, en.text, { maxWords: 20 })?.level,
      })
    },
  )
}
pairedEnglish.clear()

/** n-gram (2–5 token) → chỉ số câu ví dụ */
const exampleIndex = new Map()
for (const [index, example] of examples.entries()) {
  const t = example.tokens
  for (let n = 2; n <= 5; n++)
    for (let i = 0; i + n <= t.length; i++) {
      const key = t.slice(i, i + n).join(' ')
      const list = exampleIndex.get(key)
      if (!list) exampleIndex.set(key, [index])
      else if (list.at(-1) !== index) list.push(index)
    }
}

/** ví dụ ngắn, cùng hoặc dưới cấp chunk được ưu tiên */
function pickExamples(indexes, level) {
  const rank = LEVEL_RANK.get(level)
  return [...new Set(indexes)]
    .map((index) => examples[index])
    .sort(
      (a, b) =>
        Number(LEVEL_RANK.get(a.level) > rank + 1) -
          Number(LEVEL_RANK.get(b.level) > rank + 1) ||
        Number(a.level == null) - Number(b.level == null) ||
        a.tokens.length - b.tokens.length ||
        a.en.localeCompare(b.en),
    )
    .slice(0, MAX_EXAMPLES)
}

/* ---------- 2. Open English WordNet ---------- */

const oewnFiles = fs.readdirSync(paths.oewn).filter((f) => f.endsWith('.json'))
const synsets = new Map()
for (const file of oewnFiles.filter(
  (f) => !f.startsWith('entries') && f !== 'frames.json',
))
  for (const [id, synset] of Object.entries(
    JSON.parse(fs.readFileSync(path.join(paths.oewn, file), 'utf8')),
  ))
    synsets.set(id, synset)

const POS_ORDER = ['v', 'r', 'a', 's', 'n']
const candidates = []
for (const file of oewnFiles.filter((f) => f.startsWith('entries'))) {
  const entries = JSON.parse(
    fs.readFileSync(path.join(paths.oewn, file), 'utf8'),
  )
  for (const [lemma, byPos] of Object.entries(entries)) {
    if (!/^[a-z]+(?:'[a-z]+)?(?: [a-z]+(?:'[a-z]+)?){1,4}$/.test(lemma))
      continue
    const pos = POS_ORDER.find((p) => byPos[p]?.sense?.length)
    if (!pos) continue
    const tokens = lemma.split(' ')
    if (pos === 'v' && /^(?:be|do)$/.test(tokens[0])) continue
    if (
      pos === 'v' &&
      tokens.length === 2 &&
      LITERAL_PREPOSITIONS.has(tokens[1])
    )
      continue
    if (tokens.length === 2 && FUNCTION_OBJECTS.has(tokens[1])) continue
    const level = levelOf(tokens)
    if (!level) continue
    const sense = byPos[pos].sense[0]
    // nhiều nghĩa thì hiện 2 nghĩa đầu: không đoán được câu ví dụ thuộc nghĩa nào
    const definition = byPos[pos].sense
      .slice(0, 2)
      .map((s) => synsets.get(s.synset)?.definition?.[0])
      .filter(Boolean)
      .join(' · ')
    if (!definition) continue
    const variants =
      pos === 'v'
        ? verbForms(tokens[0]).map((form) =>
            [form, ...tokens.slice(1)].join(' '),
          )
        : [lemma]
    const found = variants.flatMap((v) => exampleIndex.get(v) ?? [])
    // danh từ/tính từ ghép dễ là thuật ngữ: cần ít nhất 2 câu ví dụ
    if (found.length < (pos === 'v' || pos === 'r' ? 1 : 2)) continue
    candidates.push({
      pos,
      kind:
        pos === 'v' && (PARTICLES.has(tokens.at(-1)) || tokens.length > 2)
          ? 'phrasal-verb'
          : 'collocation',
      lemma,
      tokens,
      variants,
      level,
      senseId: sense.id,
      definition,
      found,
    })
  }
}

/* ---------- 3. khung câu đầu câu từ Tatoeba ---------- */

const frameCandidates = new Map()
for (const example of examples)
  for (const n of [3, 4]) {
    if (example.tokens.length <= n) continue
    const key = example.tokens.slice(0, n).join(' ')
    if (!frameCandidates.has(key)) frameCandidates.set(key, { n, count: 0 })
  }

/** tần suất trên toàn bộ câu tiếng Anh: chunk WordNet (mọi vị trí) và khung câu (đầu câu) */
const variantOf = new Map()
for (const [index, candidate] of candidates.entries())
  for (const variant of candidate.variants) variantOf.set(variant, index)
const frequency = new Array(candidates.length).fill(0)
/** số câu mở đầu bằng cụm trạng từ + dấu phẩy ("Of course, …"): dấu hiệu của từ nối */
const markerStarts = new Array(candidates.length).fill(0)
{
  const { lines, completed } = commandLines('bzcat', [paths.english])
  for await (const line of lines) {
    const [, lang, text] = line.split('\t')
    if (lang !== 'eng' || !text) continue
    const t = englishTokens(text)
    for (const n of [3, 4]) {
      const frame = frameCandidates.get(t.slice(0, n).join(' '))
      if (frame && t.length > n) frame.count++
    }
    for (let n = 2; n <= 5; n++)
      for (let i = 0; i + n <= t.length; i++) {
        const index = variantOf.get(t.slice(i, i + n).join(' '))
        if (index === undefined) continue
        frequency[index]++
        if (
          i === 0 &&
          candidates[index].pos === 'r' &&
          text
            .toLowerCase()
            .replace(/[’‘]/g, "'")
            .startsWith(`${candidates[index].lemma},`)
        )
          markerStarts[index]++
      }
  }
  await completed
}

const frames = []
for (const [key, frame] of frameCandidates) {
  if (frame.count < MIN_FRAME_COUNT) continue
  const tokens = key.split(' ')
  if (FRAME_BAD_END.has(tokens.at(-1))) continue
  // "would you like" nhường chỗ cho "would you like to" nếu phần lớn câu đều tiếp tục như vậy
  if (frame.n === 3) {
    const longer = [...frameCandidates].filter(
      ([k, f]) =>
        f.n === 4 && k.startsWith(`${key} `) && f.count >= frame.count * 0.7,
    )
    if (longer.length) continue
  }
  const level = levelOf(tokens)
  if (!level) continue
  frames.push({ key, tokens, level, count: frame.count })
}

/* ---------- 4. ghi snapshot ---------- */

const rows = []
for (const [index, c] of candidates.entries()) {
  if (frequency[index] < MIN_PHRASE_COUNT) continue
  const chosen = pickExamples(c.found, c.level.level)
  if (!chosen.length) continue
  const kind = markerStarts[index] >= 3 ? 'discourse-marker' : c.kind
  rows.push({
    id: `oewn-${c.senseId}`,
    text: c.lemma,
    sense: c.definition,
    definitionEn: c.definition,
    kind,
    level: c.level.level,
    topic: topicFor(`${c.lemma} ${chosen[0].en}`),
    frequency: frequency[index],
    content: { source: 'oewn', sourceId: c.senseId },
    forms: c.variants,
    levelSource: c.level.profile,
    levelHeadwords: c.level.matched,
    examples: chosen.map(({ tokens: _t, level: _l, ...rest }) => rest),
  })
}
for (const f of frames) {
  const chosen = pickExamples(
    examples.flatMap((e, i) =>
      e.tokens.slice(0, f.tokens.length).join(' ') === f.key ? [i] : [],
    ),
    f.level.level,
  )
  if (!chosen.length) continue
  // giữ chữ hoa/dấu nháy như câu gốc: lấy đúng phần đầu câu ví dụ đầu tiên
  const words = chosen[0].en.split(/\s+/).slice(0, f.tokens.length).join(' ')
  rows.push({
    id: `tatoeba-frame-${f.key.replace(/[^a-z0-9]+/g, '-')}`,
    text: `${words.replace(/[,.!?]+$/, '')} …`,
    sense: '',
    definitionEn: null,
    kind: 'sentence-frame',
    level: f.level.level,
    topic: topicFor(chosen.map((e) => e.en).join(' ')),
    frequency: f.count,
    content: { source: 'tatoeba-frame', sourceId: f.key },
    forms: [f.key],
    levelSource: f.level.profile,
    levelHeadwords: f.level.matched,
    examples: chosen.map(({ tokens: _t, level: _l, ...rest }) => rest),
  })
}

rows.sort(
  (a, b) =>
    LEVEL_RANK.get(a.level) - LEVEL_RANK.get(b.level) ||
    b.frequency - a.frequency ||
    a.id.localeCompare(b.id),
)
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)

const count = (pred) =>
  Object.fromEntries(
    LEVEL_ORDER.map((l) => [
      l,
      rows.filter((r) => r.level === l && pred(r)).length,
    ]),
  )
console.log(
  `Đã nhập ${rows.length} cụm từ (${examples.length} câu ví dụ Anh–Việt)`,
)
console.log(
  'phrasal verb',
  count((r) => r.kind === 'phrasal-verb'),
)
console.log(
  'collocation',
  count((r) => r.kind === 'collocation'),
)
console.log(
  'từ nối',
  count((r) => r.kind === 'discourse-marker'),
)
console.log(
  'khung câu',
  count((r) => r.kind === 'sentence-frame'),
)
