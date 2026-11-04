import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const SOURCE_DIR = path.join(ROOT, 'src/chunks-data/sources')
const OUTPUT = path.join(ROOT, 'src/chunks-data/chunks.seed.json')
const THIRD_PARTY_OUTPUT = path.join(ROOT, 'THIRD_PARTY_CONTENT.md')
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const TOPICS = [
  'daily-life',
  'work',
  'travel',
  'study',
  'communication',
  'opinions',
]
const KINDS = [
  'formula',
  'sentence-frame',
  'collocation',
  'phrasal-verb',
  'discourse-marker',
]
const ALLOWED_LICENSES = new Set([
  'CEFR-J-ATTRIBUTION',
  'CC BY 2.0 FR',
  'CC BY 4.0',
  'CC BY-SA 4.0',
  'CC0-1.0',
  'PUBLIC DOMAIN',
  'OANC-OPEN',
])
const REFERENCE_ONLY = new Set([
  'english-vocabulary-profile',
  'phave',
  'wiktionary',
  'lancslex',
  'conye-book-of-chunks',
])
const DENIED_TEXT =
  /cambridge dictionary|collocations in use|academic phrasebank/i
const CEFR_URL =
  'https://github.com/openlanguageprofiles/olp-en-cefrj/blob/master/cefrj-vocabulary-profile-1.5.csv'
const OCTANOVE_URL =
  'https://github.com/openlanguageprofiles/olp-en-cefrj/blob/master/octanove-vocabulary-profile-c1c2-1.0.csv'

const normalize = (value) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeSense = (value) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('vi')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function readSourceRows() {
  if (!fs.existsSync(SOURCE_DIR)) throw new Error(`Thiếu ${SOURCE_DIR}`)
  const rows = []
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((file) => file.endsWith('.source.jsonl'))
    .sort()
  if (!files.length) throw new Error('Không có source snapshot để build chunks')

  for (const file of files) {
    const source = file.split('.')[0]
    if (REFERENCE_ONLY.has(source))
      throw new Error(`${file}: nguồn reference-only không được import`)
    const lines = fs
      .readFileSync(path.join(SOURCE_DIR, file), 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
    for (const [index, line] of lines.entries()) {
      try {
        rows.push({ ...JSON.parse(line), importedFrom: file })
      } catch {
        throw new Error(`${file}:${index + 1}: JSON không hợp lệ`)
      }
    }
  }
  return rows
}

function tatoebaAttributions(row) {
  const source = row.source
  if (
    !source?.englishId ||
    !source.englishAuthor ||
    !source.vietnameseId ||
    !source.vietnameseAuthor
  )
    throw new Error(`${row.text}: thiếu metadata Tatoeba`)

  const levelIsOctanove = source.levelSource === 'octanove'
  return [
    {
      source: 'tatoeba',
      sourceId: source.englishId,
      sourceUrl: `https://tatoeba.org/en/sentences/show/${source.englishId}`,
      author: source.englishAuthor,
      license: 'CC BY 2.0 FR',
      attribution: `Tatoeba #${source.englishId} by ${source.englishAuthor}`,
      role: 'content',
    },
    {
      source: 'tatoeba',
      sourceId: source.vietnameseId,
      sourceUrl: `https://tatoeba.org/en/sentences/show/${source.vietnameseId}`,
      author: source.vietnameseAuthor,
      license: 'CC BY 2.0 FR',
      attribution: `Tatoeba #${source.vietnameseId} by ${source.vietnameseAuthor}`,
      role: 'translation',
    },
    {
      source: levelIsOctanove ? 'octanove' : 'cefr-j',
      sourceId: source.levelHeadwords.join(','),
      sourceUrl: levelIsOctanove ? OCTANOVE_URL : CEFR_URL,
      author: levelIsOctanove
        ? 'Octanove Labs'
        : 'Tono Laboratory, Tokyo University of Foreign Studies',
      license: levelIsOctanove ? 'CC BY-SA 4.0' : 'CEFR-J-ATTRIBUTION',
      attribution: levelIsOctanove
        ? 'Octanove Vocabulary Profile C1/C2'
        : 'CEFR-J Vocabulary Profile',
      role: 'level',
    },
  ]
}

const OEWN_URL = 'https://en-word.net/'

function levelAttribution(levelSource, headwords) {
  const octanove = levelSource === 'octanove'
  return {
    source: octanove ? 'octanove' : 'cefr-j',
    sourceId: headwords.join(','),
    sourceUrl: octanove ? OCTANOVE_URL : CEFR_URL,
    author: octanove
      ? 'Octanove Labs'
      : 'Tono Laboratory, Tokyo University of Foreign Studies',
    license: octanove ? 'CC BY-SA 4.0' : 'CEFR-J-ATTRIBUTION',
    attribution: octanove
      ? 'Octanove Vocabulary Profile C1/C2'
      : 'CEFR-J Vocabulary Profile',
    role: 'level',
  }
}

const tatoebaCredit = (id, author, role) => ({
  source: 'tatoeba',
  sourceId: id,
  sourceUrl: `https://tatoeba.org/en/sentences/show/${id}`,
  author,
  license: 'CC BY 2.0 FR',
  attribution: `Tatoeba #${id} by ${author}`,
  role,
})

/** cụm từ OEWN / khung câu Tatoeba (import-phrases.mjs): ví dụ và bản dịch nguyên văn Tatoeba */
function phraseChunk(row) {
  if (!row.examples?.length) throw new Error(`${row.text}: thiếu câu ví dụ`)
  for (const e of row.examples)
    if (!e.enId || !e.enAuthor || !e.viId || !e.viAuthor)
      throw new Error(`${row.text}: thiếu metadata Tatoeba của ví dụ`)
  const content =
    row.content.source === 'oewn'
      ? [
          {
            source: 'open-english-wordnet',
            sourceId: row.content.sourceId,
            sourceUrl: `${OEWN_URL}lemma/${encodeURIComponent(row.text)}`,
            author: 'Open English WordNet contributors',
            license: 'CC BY 4.0',
            attribution: `Open English WordNet 2025 · ${row.text}`,
            role: 'content',
          },
          {
            source: 'open-english-wordnet',
            sourceId: row.content.sourceId,
            sourceUrl: `${OEWN_URL}lemma/${encodeURIComponent(row.text)}`,
            author: 'Open English WordNet contributors',
            license: 'CC BY 4.0',
            attribution: 'Open English WordNet 2025 (định nghĩa)',
            role: 'sense',
          },
        ]
      : [
          {
            source: 'tatoeba',
            sourceId: row.content.sourceId,
            sourceUrl: `https://tatoeba.org/en/sentences/search?from=eng&query=${encodeURIComponent(`"${row.content.sourceId}"`)}`,
            author: 'Tatoeba contributors',
            license: 'CC BY 2.0 FR',
            attribution: 'Khung câu đếm tần suất trên câu tiếng Anh Tatoeba',
            role: 'content',
          },
        ]
  return {
    id: row.id,
    text: String(row.text).trim(),
    normalizedText: normalize(String(row.text)),
    sense: String(row.sense ?? '').trim(),
    definitionEn: row.definitionEn ? String(row.definitionEn).trim() : null,
    level: row.level,
    topic: row.topic,
    kind: row.kind,
    frequency: Number(row.frequency) || 0,
    meaningVi: null,
    exampleEn: row.examples[0].en,
    exampleVi: row.examples[0].vi,
    examples: row.examples.map((e) => ({
      en: e.en,
      vi: e.vi,
      enId: e.enId,
      viId: e.viId,
    })),
    // dạng chuẩn hoá để nhận diện chunk trong bài đọc/nghe/phụ đề (give up → gave up, giving up…)
    forms: [...new Set((row.forms ?? [row.text]).map(normalize))],
    audioUrl: null,
    sourceVerified: true,
    reviewed: false,
    attributions: [
      ...content,
      ...row.examples.flatMap((e) => [
        tatoebaCredit(e.enId, e.enAuthor, 'example'),
        tatoebaCredit(e.viId, e.viAuthor, 'translation'),
      ]),
      levelAttribution(row.levelSource, row.levelHeadwords),
    ],
  }
}

function toChunk(row) {
  if (row.importedFrom.startsWith('phrases.')) return phraseChunk(row)
  if (!row.importedFrom.startsWith('tatoeba-'))
    throw new Error(`${row.importedFrom}: chưa có adapter source-only`)
  return {
    id: `tatoeba-${row.source.englishId}-${row.source.vietnameseId}`,
    text: String(row.text).trim(),
    normalizedText: normalize(String(row.text)),
    sense: String(row.sense).trim(),
    definitionEn: null,
    level: row.level,
    topic: row.topic,
    kind: row.kind,
    frequency: Number(row.frequency) || 0,
    meaningVi: String(row.meaningVi).trim(),
    exampleEn: String(row.exampleEn).trim(),
    exampleVi: String(row.exampleVi).trim(),
    examples: [],
    forms: [],
    audioUrl: row.audioUrl ? String(row.audioUrl) : null,
    sourceVerified: row.sourceVerified === true,
    reviewed: row.reviewed === true,
    attributions: tatoebaAttributions(row),
  }
}

function validate(chunks) {
  const errors = []
  if (!chunks.length) errors.push('kho source-only đang trống')
  const ids = new Set()
  const senses = new Set()
  const counts = Object.fromEntries(LEVELS.map((level) => [level, 0]))
  const topicCounts = Object.fromEntries(TOPICS.map((topic) => [topic, 0]))

  for (const [index, chunk] of chunks.entries()) {
    const at = `#${index + 1} ${chunk.text}`
    if (!LEVELS.includes(chunk.level)) errors.push(`${at}: level không hợp lệ`)
    else counts[chunk.level]++
    if (!TOPICS.includes(chunk.topic)) errors.push(`${at}: topic không hợp lệ`)
    else topicCounts[chunk.topic]++
    if (!KINDS.includes(chunk.kind)) errors.push(`${at}: kind không hợp lệ`)
    if (!chunk.sourceVerified) errors.push(`${at}: nguồn chưa được xác minh`)
    if (!chunk.text || !chunk.exampleEn || !chunk.exampleVi)
      errors.push(`${at}: thiếu nội dung học`)
    if (
      !chunk.meaningVi &&
      !chunk.definitionEn &&
      chunk.kind !== 'sentence-frame'
    )
      errors.push(`${at}: thiếu nghĩa (tiếng Việt hoặc định nghĩa nguồn)`)
    if (DENIED_TEXT.test(JSON.stringify(chunk)))
      errors.push(`${at}: chứa nội dung thuộc denylist`)
    if (ids.has(chunk.id)) errors.push(`${at}: trùng id`)
    ids.add(chunk.id)
    const senseKey = `${chunk.normalizedText}|${normalizeSense(chunk.sense)}`
    if (senses.has(senseKey)) errors.push(`${at}: trùng text + sense`)
    senses.add(senseKey)

    const roles = new Set(chunk.attributions.map((credit) => credit.role))
    if (!roles.has('content')) errors.push(`${at}: thiếu nguồn nội dung`)
    if (!roles.has('translation')) errors.push(`${at}: thiếu nguồn bản dịch`)
    if (!roles.has('level')) errors.push(`${at}: thiếu nguồn CEFR`)
    for (const credit of chunk.attributions) {
      if (REFERENCE_ONLY.has(credit.source))
        errors.push(`${at}: nguồn ${credit.source} chỉ được tham khảo`)
      if (!ALLOWED_LICENSES.has(credit.license))
        errors.push(`${at}: license ${credit.license} không được phép`)
      try {
        new URL(credit.sourceUrl)
      } catch {
        errors.push(`${at}: sourceUrl không hợp lệ`)
      }
      if (!credit.sourceId || !credit.author || !credit.attribution)
        errors.push(`${at}: attribution không đầy đủ`)
    }
  }

  for (const level of LEVELS)
    if (!counts[level]) errors.push(`${level}: không có dữ liệu`)
  for (const topic of TOPICS)
    if (!topicCounts[topic]) errors.push(`${topic}: không có dữ liệu`)
  if (errors.length)
    throw new Error(
      `Chunk QA thất bại:\n- ${errors.slice(0, 100).join('\n- ')}`,
    )
  return { counts, topicCounts }
}

const unique = new Map()
for (const chunk of readSourceRows().map(toChunk)) {
  const key = `${chunk.normalizedText}|${normalizeSense(chunk.sense)}`
  if (!unique.has(key)) unique.set(key, chunk)
}

/** audio Common Voice (import-common-voice.mjs): gắn vào chunk có câu ví dụ khớp chính xác */
const AUDIO_FILE = path.join(SOURCE_DIR, 'common-voice.audio.jsonl')
if (fs.existsSync(AUDIO_FILE)) {
  const audio = new Map(
    fs
      .readFileSync(AUDIO_FILE, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .map((row) => [row.normalizedSentence, row]),
  )
  for (const chunk of unique.values()) {
    const clip = audio.get(normalize(chunk.exampleEn))
    if (!clip) continue
    if (!fs.existsSync(path.join(ROOT, 'public/chunk-audio', clip.clip)))
      throw new Error(`Thiếu file audio public/chunk-audio/${clip.clip}`)
    chunk.audioUrl = `/chunk-audio/${clip.clip}`
    chunk.attributions.push({
      source: 'common-voice',
      sourceId: clip.clip,
      sourceUrl: 'https://commonvoice.mozilla.org/en/datasets',
      author: 'Mozilla Common Voice contributor',
      license: 'CC0-1.0',
      attribution: `Mozilla Common Voice · ${clip.clip}`,
      role: 'audio',
    })
  }
}

const chunks = [...unique.values()].sort(
  (a, b) =>
    LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) ||
    b.frequency - a.frequency ||
    a.text.localeCompare(b.text) ||
    a.sense.localeCompare(b.sense, 'vi'),
)
const report = validate(chunks)
const json = `${JSON.stringify(chunks, null, 2)}\n`
const thirdParty = `# Third-party content

File này được sinh bởi \`pnpm chunks:build\`. Kho chunks là **source-only**: không có câu hoặc bản dịch tự biên soạn và không đặt giới hạn số lượng.

| Nguồn | Giấy phép/chính sách | Cách dùng |
|---|---|---|
| [Tatoeba](https://tatoeba.org/) | CC BY 2.0 FR | Câu tiếng Anh và bản dịch tiếng Việt; từng record giữ sentence ID và tác giả. |
| [CEFR-J Vocabulary Profile](https://github.com/openlanguageprofiles/olp-en-cefrj) | CEFR-J terms with attribution | Gán cấp A1–B2 theo toàn bộ headword trong câu. |
| [Octanove Vocabulary Profile C1/C2](https://github.com/openlanguageprofiles/olp-en-cefrj) | CC BY-SA 4.0 | Gán cấp C1; mục C2 không được nhập vào kho A1–C1. |
| [Open English WordNet 2025](https://en-word.net/) | CC BY 4.0 | Phrasal verb, collocation, từ nối nhiều từ và định nghĩa tiếng Anh; chỉ giữ cụm có câu ví dụ Anh–Việt trên Tatoeba. |
| [Mozilla Common Voice](https://commonvoice.mozilla.org/) | CC0-1.0 | Audio người thật đọc (tuỳ chọn, chỉ khi chạy \`pnpm chunks:import:common-voice\` với bộ dữ liệu tải về máy). |

Khung câu đầu câu (vd. “Would you like to …”) được đếm tần suất trên toàn bộ câu tiếng Anh Tatoeba; câu ví dụ và bản dịch là câu Tatoeba nguyên văn, ghi ID và tác giả từng câu.

Snapshot hiện tại được tạo từ weekly exports Tatoeba ngày 2026-10-31. Audio Tatoeba không được nhập vì giấy phép audio tách riêng theo người đóng góp.

## Nguồn chỉ tham khảo

English Vocabulary Profile, PHaVE List, Wiktionary, LancsLex và The Book of Chunks from CONYE không được pipeline nhập làm nội dung, ví dụ hoặc audio.
`

if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== json)
    throw new Error(
      'chunks.seed.json chưa được cập nhật; chạy pnpm chunks:build',
    )
  if (
    !fs.existsSync(THIRD_PARTY_OUTPUT) ||
    fs.readFileSync(THIRD_PARTY_OUTPUT, 'utf8') !== thirdParty
  )
    throw new Error(
      'THIRD_PARTY_CONTENT.md chưa được cập nhật; chạy pnpm chunks:build',
    )
} else {
  fs.writeFileSync(OUTPUT, json)
  fs.writeFileSync(THIRD_PARTY_OUTPUT, thirdParty)
}

console.log(`Chunks OK: ${chunks.length}`, report)
