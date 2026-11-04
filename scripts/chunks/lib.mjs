/** Hàm dùng chung cho các importer chunks (chạy lúc build, đọc snapshot tải về máy). */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import readline from 'node:readline'

export const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1']
export const LEVEL_RANK = new Map(
  LEVEL_ORDER.map((level, index) => [level, index]),
)

/** `--key value` → Map */
export function parseArgs(argv = process.argv) {
  const args = new Map()
  for (let index = 2; index < argv.length; index += 2)
    args.set(argv[index], argv[index + 1])
  return args
}

export function requireFiles(paths) {
  for (const [name, filename] of Object.entries(paths))
    if (!fs.existsSync(filename)) throw new Error(`Thiếu ${name}: ${filename}`)
}

/** chạy lệnh (bzcat, tar…) và đọc stdout từng dòng */
export function commandLines(command, commandArgs) {
  const child = spawn(command, commandArgs, {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const lines = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  })
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} thoát với mã ${code}`))
    })
  })
  return { lines, completed }
}

export function parseCsvLine(line) {
  const cells = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"'
        index++
      } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(cell)
      cell = ''
    } else cell += char
  }
  cells.push(cell)
  return cells
}

export function normalizeWord(value) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^'+|'+$/g, '')
}

function addProfile(filename, map, profile) {
  const lines = fs.readFileSync(filename, 'utf8').split(/\r?\n/).filter(Boolean)
  const header = parseCsvLine(lines.shift())
  const headwordIndex = header.indexOf('headword')
  const levelIndex = header.indexOf('CEFR')
  for (const line of lines) {
    const cells = parseCsvLine(line)
    const rawLevel = cells[levelIndex]?.trim().toUpperCase()
    const level = rawLevel === 'C2' ? null : rawLevel
    if (!LEVEL_RANK.has(level)) continue
    for (const variant of cells[headwordIndex].split('/')) {
      const word = normalizeWord(variant)
      if (!/^[a-z]+(?:'[a-z]+)?$/.test(word)) continue
      const current = map.get(word)
      if (!current || LEVEL_RANK.get(level) < LEVEL_RANK.get(current.level))
        map.set(word, { level, profile })
    }
  }
}

/** từ → { level, profile } theo CEFR-J (A1–B2) rồi Octanove (C1; bỏ C2) */
export function loadVocabulary(cefrPath, octanovePath) {
  const vocabulary = new Map()
  addProfile(cefrPath, vocabulary, 'cefr-j')
  addProfile(octanovePath, vocabulary, 'octanove')
  return vocabulary
}

const ignoredTokens = new Set(['s', 't', 'm', 're', 've', 'll', 'd', 'nt'])

export const englishTokens = (text) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .match(/[a-z]+(?:'[a-z]+)?/g) ?? []

/**
 * Cấp CEFR = cấp cao nhất của mọi headword; có từ không xác định cấp thì trả null.
 * `maxWords` giới hạn độ dài (câu Tatoeba: 2–12 từ).
 */
export function classifyLevel(
  vocabulary,
  text,
  { minWords = 2, maxWords = 12 } = {},
) {
  const words = englishTokens(text)
  if (words.length < minWords || words.length > maxWords) return null

  let result = { level: 'A1', profile: 'cefr-j', matched: [] }
  for (const token of words) {
    const parts = token.split("'").filter(Boolean)
    const entries = parts
      .filter((part) => !ignoredTokens.has(part))
      .map((part) => vocabulary.get(part))
    if (!entries.length || entries.some((entry) => !entry)) return null
    for (const entry of entries) {
      result.matched.push(token)
      if (LEVEL_RANK.get(entry.level) > LEVEL_RANK.get(result.level))
        result = { ...result, level: entry.level, profile: entry.profile }
    }
  }
  result.matched = [...new Set(result.matched)]
  return result
}

export function topicFor(text) {
  const value = text.toLowerCase()
  const rules = [
    [
      'travel',
      /\b(?:airport|bus|hotel|station|ticket|train|travel|trip|flight)\b/,
    ],
    ['work', /\b(?:boss|business|company|job|meeting|office|work)\b/],
    ['study', /\b(?:book|class|learn|school|student|study|teacher|test)\b/],
    [
      'communication',
      /\b(?:ask|call|hear|listen|repeat|say|speak|talk|tell|understand)\b/,
    ],
    [
      'opinions',
      /\b(?:agree|believe|feel|guess|idea|opinion|prefer|seem|think)\b/,
    ],
  ]
  return rules.find(([, pattern]) => pattern.test(value))?.[0] ?? 'daily-life'
}

export function isSuitableEnglish(text) {
  return (
    /^[A-Z"'“‘(]/.test(text) &&
    /[.!?]$/.test(text) &&
    !/[\[\]{}<>]|https?:|www\./i.test(text) &&
    !/\b(?:cambridge dictionary|collocations in use|academic phrasebank)\b/i.test(
      text,
    )
  )
}

/** id → { text, author } của một file export Tatoeba `*_sentences_detailed.tsv.bz2` */
export async function readTatoebaSentences(
  file,
  language,
  accept = () => true,
) {
  const out = new Map()
  const { lines, completed } = commandLines('bzcat', [file])
  for await (const line of lines) {
    const [id, lang, text, author] = line.split('\t')
    if (lang !== language || !text?.trim() || !author || author === '\\N')
      continue
    const value = accept(text.trim())
    if (value)
      out.set(id, {
        text: text.trim(),
        author,
        ...(value === true ? {} : value),
      })
  }
  await completed
  return out
}

/** gọi `onPair(englishId, vietnameseId)` cho mỗi liên kết trực tiếp Anh–Việt trong links.tar.bz2 */
export async function forEachTatoebaLink(file, english, vietnamese, onPair) {
  const { lines, completed } = commandLines('tar', ['-xOjf', file, 'links.csv'])
  for await (const line of lines) {
    const [left, right] = line.split('\t')
    if (english.has(left) && vietnamese.has(right)) onPair(left, right)
    else if (english.has(right) && vietnamese.has(left)) onPair(right, left)
  }
  await completed
}

/** quá khứ / phân từ của động từ bất quy tắc hay gặp trong phrasal verb — chỉ để khớp ví dụ */
const IRREGULAR = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  break: ['broke', 'broken'],
  bring: ['brought'],
  catch: ['caught'],
  come: ['came'],
  cut: [],
  do: ['did', 'done', 'does'],
  fall: ['fell', 'fallen'],
  find: ['found'],
  get: ['got', 'gotten', 'getting'],
  give: ['gave', 'given'],
  go: ['went', 'gone', 'goes'],
  grow: ['grew', 'grown'],
  hang: ['hung'],
  have: ['has', 'had'],
  hold: ['held'],
  keep: ['kept'],
  know: ['knew', 'known'],
  lay: ['laid'],
  leave: ['left'],
  let: ['letting'],
  make: ['made'],
  put: ['putting'],
  run: ['ran', 'running'],
  say: ['said'],
  see: ['saw', 'seen'],
  sell: ['sold'],
  send: ['sent'],
  set: ['setting'],
  shut: ['shutting'],
  sit: ['sat', 'sitting'],
  speak: ['spoke', 'spoken'],
  stand: ['stood'],
  take: ['took', 'taken'],
  tell: ['told'],
  think: ['thought'],
  throw: ['threw', 'thrown'],
  wake: ['woke', 'woken'],
  wear: ['wore', 'worn'],
  write: ['wrote', 'written'],
}

/** các dạng chia của động từ đầu cụm */
export function verbForms(base) {
  const forms = new Set([base, ...(IRREGULAR[base] ?? [])])
  if (/(?:s|x|z|ch|sh)$/.test(base)) forms.add(`${base}es`)
  else if (/[^aeiou]y$/.test(base)) forms.add(`${base.slice(0, -1)}ies`)
  else forms.add(`${base}s`)
  if (base.endsWith('e')) {
    forms.add(`${base}d`)
    forms.add(`${base.slice(0, -1)}ing`)
  } else if (/[^aeiou]y$/.test(base)) {
    forms.add(`${base.slice(0, -1)}ied`)
    forms.add(`${base}ing`)
  } else {
    forms.add(`${base}ed`)
    forms.add(`${base}ing`)
    // stop → stopped, stopping (CVC một âm tiết)
    if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(base)) {
      const last = base.at(-1)
      forms.add(`${base}${last}ed`)
      forms.add(`${base}${last}ing`)
    }
  }
  return [...forms]
}
