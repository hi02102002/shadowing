/**
 * Audio người thật đọc từ Mozilla Common Voice (CC0) cho câu ví dụ của chunk.
 * Bộ dữ liệu phải tải thủ công (cần đăng nhập): https://commonvoice.mozilla.org/en/datasets
 *
 *   pnpm chunks:import:common-voice --dir ~/Downloads/cv-corpus-xx/en
 *   pnpm chunks:build
 *
 * Chỉ nhận clip trong validated.tsv (up_votes > down_votes) có transcript khớp chính xác câu ví dụ sau chuẩn hoá.
 * Clip khớp được chép vào public/chunk-audio/, danh sách ghi vào sources/common-voice.audio.jsonl để build gắn audio.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'

import { parseArgs } from './lib.mjs'

const ROOT = process.cwd()
const SEED = path.join(ROOT, 'src/chunks-data/chunks.seed.json')
const OUTPUT = path.join(
  ROOT,
  'src/chunks-data/sources/common-voice.audio.jsonl',
)
const AUDIO_DIR = path.join(ROOT, 'public/chunk-audio')

/** cùng cách chuẩn hoá với build-chunks.mjs */
export const normalizeSentence = (value) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** đọc validated.tsv: trả các clip đủ phiếu, mỗi câu một clip (nhiều phiếu thuận nhất) */
export async function readValidated(file, wanted) {
  const input = fs.createReadStream(file)
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  let header = null
  const best = new Map()
  for await (const line of lines) {
    const cells = line.split('\t')
    if (!header) {
      header = Object.fromEntries(cells.map((name, index) => [name, index]))
      for (const column of ['path', 'sentence', 'up_votes', 'down_votes'])
        if (!(column in header))
          throw new Error(`validated.tsv thiếu cột ${column}`)
      continue
    }
    const sentence = cells[header.sentence] ?? ''
    const key = normalizeSentence(sentence)
    if (!wanted.has(key)) continue
    const up = Number(cells[header.up_votes]) || 0
    const down = Number(cells[header.down_votes]) || 0
    if (up <= down) continue
    const current = best.get(key)
    if (!current || up - down > current.score)
      best.set(key, {
        key,
        clip: cells[header.path],
        sentenceId:
          header.sentence_id === undefined ? null : cells[header.sentence_id],
        score: up - down,
      })
  }
  return [...best.values()]
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
if (isMain) {
  const args = parseArgs()
  const dir = args.get('--dir')
  if (!dir) throw new Error('Thiếu --dir <thư mục cv-corpus-xx/en>')
  const validated = path.join(dir, 'validated.tsv')
  const clips = path.join(dir, 'clips')
  if (!fs.existsSync(validated) || !fs.existsSync(clips))
    throw new Error(`${dir} phải có validated.tsv và thư mục clips/`)

  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'))
  const wanted = new Set(
    seed.map((chunk) => normalizeSentence(chunk.exampleEn)),
  )
  const matches = await readValidated(validated, wanted)

  fs.mkdirSync(AUDIO_DIR, { recursive: true })
  const rows = []
  for (const match of matches.sort((a, b) => a.key.localeCompare(b.key))) {
    const from = path.join(clips, match.clip)
    if (!fs.existsSync(from)) continue
    fs.copyFileSync(from, path.join(AUDIO_DIR, path.basename(match.clip)))
    rows.push({
      normalizedSentence: match.key,
      clip: path.basename(match.clip),
      sentenceId: match.sentenceId,
    })
  }
  fs.writeFileSync(
    OUTPUT,
    rows.length ? `${rows.map((r) => JSON.stringify(r)).join('\n')}\n` : '',
  )
  console.log(
    `Đã nhận ${rows.length} clip Common Voice khớp câu ví dụ (${wanted.size} câu cần audio)`,
  )
}
