/**
 * Đọc gói deck Anki (.apkg): file zip chứa
 * - collection.anki21b (Anki ≥ 2.1.50, SQLite nén zstd, schema v18: bảng notetypes/fields)
 *   hoặc collection.anki21 / collection.anki2 (schema cũ: note type nằm trong JSON col.models)
 * - media: bản đồ "0" → "tên-file.mp3" (JSON, hoặc protobuf nén zstd ở bản mới)
 * - 0, 1, 2…: file media (bản mới cũng nén zstd)
 */
import { zstdDecompressSync } from 'node:zlib'
import Database from 'better-sqlite3'
import { unzipSync } from 'fflate'

export interface AnkiNotetype {
  id: string
  name: string
  fields: string[]
  noteCount: number
  /** vài note đầu, đã bỏ HTML, để người dùng xem trước khi map trường */
  samples: string[][]
  /** trường có [sound:…] ở các note mẫu → gợi ý làm trường audio */
  soundFields: number[]
}

export interface AnkiNote {
  guid: string
  notetypeId: string
  /** nội dung gốc (HTML) của từng trường */
  fields: string[]
}

export interface AnkiPackage {
  deckName: string
  notetypes: AnkiNotetype[]
  notes: AnkiNote[]
  /** lấy nội dung file media theo tên dùng trong [sound:…], null nếu gói không có */
  media: (names: string[]) => Map<string, Uint8Array>
}

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd]
const isZstd = (b: Uint8Array) => ZSTD_MAGIC.every((v, i) => b[i] === v)
const maybeZstd = (b: Uint8Array) =>
  isZstd(b) ? new Uint8Array(zstdDecompressSync(b)) : b

const SAMPLE_COUNT = 3

export function readApkg(zip: Uint8Array): AnkiPackage {
  const COLLECTIONS = ['collection.anki21b', 'collection.anki21', 'collection.anki2']
  const head = unzipSync(zip, {
    filter: (f) => COLLECTIONS.includes(f.name) || f.name === 'media',
  })
  const collectionName = COLLECTIONS.find((n) => n in head)
  if (!collectionName) throw new Error('File không phải gói Anki (.apkg)')

  const { deckName, notetypes, notes } = readCollection(
    maybeZstd(head[collectionName]),
  )
  const mediaIndex = 'media' in head ? parseMediaMap(head.media) : new Map<string, string>()

  return {
    deckName,
    notetypes,
    notes,
    media: (names) => {
      // tên file trong note → tên entry trong zip ("0", "1"…)
      const wanted = new Map<string, string>()
      for (const name of names) {
        const entry = mediaIndex.get(name)
        if (entry) wanted.set(entry, name)
      }
      const out = new Map<string, Uint8Array>()
      if (!wanted.size) return out
      const files = unzipSync(zip, { filter: (f) => wanted.has(f.name) })
      for (const [entry, data] of Object.entries(files)) {
        out.set(wanted.get(entry)!, maybeZstd(data))
      }
      return out
    },
  }
}

function readCollection(bytes: Uint8Array) {
  // better-sqlite3 không mở được bản serialize ở chế độ WAL → đổi header về rollback journal
  const buf = Buffer.from(bytes)
  if (buf[18] === 2) buf[18] = 1
  if (buf[19] === 2) buf[19] = 1
  const db = new Database(buf, { readonly: true })
  try {
    const hasTable = (name: string) =>
      !!db
        .prepare(`select 1 from sqlite_master where type = 'table' and name = ?`)
        .get(name)

    const types = new Map<string, { name: string; fields: string[] }>()
    const deckNames = new Map<string, string>()
    if (hasTable('notetypes')) {
      for (const t of db.prepare('select id, name from notetypes').all() as {
        id: number
        name: string
      }[]) {
        const fields = (
          db
            .prepare('select name from fields where ntid = ? order by ord')
            .all(t.id) as { name: string }[]
        ).map((f) => f.name)
        types.set(String(t.id), { name: t.name, fields })
      }
      for (const d of db.prepare('select id, name from decks').all() as {
        id: number
        name: string
      }[]) {
        deckNames.set(String(d.id), d.name.replaceAll('\x1f', '::'))
      }
    } else {
      const col = db.prepare('select models, decks from col').get() as {
        models: string
        decks: string
      }
      const models = JSON.parse(col.models) as Record<
        string,
        { name: string; flds: { name: string; ord: number }[] }
      >
      for (const [id, m] of Object.entries(models)) {
        const fields = [...m.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name)
        types.set(id, { name: m.name, fields })
      }
      const decks = JSON.parse(col.decks) as Record<string, { name: string }>
      for (const [id, d] of Object.entries(decks)) deckNames.set(id, d.name)
    }

    const notes = (
      db.prepare('select guid, mid, flds from notes order by id').all() as {
        guid: string
        mid: number
        flds: string
      }[]
    ).map(
      (n): AnkiNote => ({
        guid: n.guid,
        notetypeId: String(n.mid),
        fields: n.flds.split('\x1f'),
      }),
    )

    // tên deck = deck chứa nhiều thẻ nhất (gói thường chỉ có một deck + "Default" rỗng)
    const top = db
      .prepare('select did, count(*) as n from cards group by did order by n desc limit 1')
      .get() as { did: number } | undefined
    const deckName = (top && deckNames.get(String(top.did))) || 'Anki'

    const notetypes: AnkiNotetype[] = []
    for (const [id, t] of types) {
      const own = notes.filter((n) => n.notetypeId === id)
      if (!own.length) continue
      const sampleNotes = own.slice(0, SAMPLE_COUNT)
      notetypes.push({
        id,
        name: t.name,
        fields: t.fields,
        noteCount: own.length,
        samples: sampleNotes.map((n) => n.fields.map((f) => cleanField(f).text)),
        soundFields: t.fields
          .map((_, i) => i)
          .filter((i) => sampleNotes.some((n) => /\[sound:/.test(n.fields[i] ?? ''))),
      })
    }
    return { deckName, notetypes, notes }
  } finally {
    db.close()
  }
}

/** bản đồ tên file media → tên entry trong zip */
export function parseMediaMap(raw: Uint8Array): Map<string, string> {
  const map = new Map<string, string>()
  if (isZstd(raw)) {
    // MediaEntries { repeated MediaEntry entries = 1 }
    // MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; optional uint32 legacy_zip_filename = 255 }
    readProto(new Uint8Array(zstdDecompressSync(raw)), (field, value, index) => {
      if (field !== 1 || !(value instanceof Uint8Array)) return
      const entry: { name: string; legacy: number | null } = { name: '', legacy: null }
      readProto(value, (f, v) => {
        if (f === 1 && v instanceof Uint8Array) entry.name = new TextDecoder().decode(v)
        if (f === 255 && typeof v === 'number') entry.legacy = v
      })
      if (entry.name) map.set(entry.name, String(entry.legacy ?? index))
    })
    return map
  }
  const text = new TextDecoder().decode(raw).trim()
  if (!text) return map
  for (const [entry, name] of Object.entries(JSON.parse(text) as Record<string, string>)) {
    map.set(name, entry)
  }
  return map
}

/** duyệt các trường của một message protobuf; `index` đếm số lần gặp trường lặp đó */
function readProto(
  buf: Uint8Array,
  visit: (field: number, value: number | Uint8Array, index: number) => void,
) {
  let pos = 0
  const seen = new Map<number, number>()
  const varint = () => {
    let result = 0
    let shift = 0
    for (;;) {
      if (pos >= buf.length) throw new Error('Protobuf hỏng')
      const b = buf[pos++]
      result += (b & 0x7f) * 2 ** shift
      if (!(b & 0x80)) return result
      shift += 7
    }
  }
  while (pos < buf.length) {
    const key = varint()
    const field = Math.floor(key / 8)
    const wire = key & 7
    let value: number | Uint8Array
    if (wire === 0) value = varint()
    else if (wire === 2) {
      const len = varint()
      value = buf.subarray(pos, pos + len)
      pos += len
    } else if (wire === 1) {
      pos += 8
      continue
    } else if (wire === 5) {
      pos += 4
      continue
    } else throw new Error('Protobuf hỏng')
    const index = seen.get(field) ?? 0
    seen.set(field, index + 1)
    visit(field, value, index)
  }
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  hellip: '…',
}

/** HTML của một trường → chữ thuần + danh sách file âm thanh [sound:…] */
export function cleanField(html: string): { text: string; sounds: string[] } {
  const sounds: string[] = []
  const text = html
    .replace(/\[sound:([^\]]+)\]/g, (_, name: string) => {
      sounds.push(name.trim())
      return ''
    })
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(div|p|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
        return Number.isFinite(n) ? String.fromCodePoint(n) : m
      }
      return (ENTITIES as Record<string, string | undefined>)[code.toLowerCase()] ?? m
    })
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return { text, sounds }
}
