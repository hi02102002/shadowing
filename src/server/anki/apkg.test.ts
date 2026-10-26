import { zstdCompressSync } from 'node:zlib'
import Database from 'better-sqlite3'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { cleanField, parseMediaMap, readApkg } from './apkg.ts'

const AUDIO = new Uint8Array([1, 2, 3, 4])

/** gói kiểu cũ: collection.anki2, note type trong col.models, media là JSON */
function legacyApkg() {
  const db = new Database(':memory:')
  db.exec(`
    create table col (models text, decks text);
    create table notes (id integer, guid text, mid integer, flds text);
    create table cards (id integer, nid integer, did integer);
  `)
  db.prepare('insert into col values (?, ?)').run(
    JSON.stringify({
      '111': { name: 'Basic', flds: [{ name: 'Back', ord: 1 }, { name: 'Front', ord: 0 }] },
    }),
    JSON.stringify({ '1': { name: 'Default' }, '42': { name: 'English::Words' } }),
  )
  db.prepare('insert into notes values (1, ?, 111, ?)').run(
    'g1',
    'hello [sound:hello.mp3]\x1fxin <b>chào</b>&nbsp;bạn<br>lời chào',
  )
  db.prepare('insert into notes values (2, ?, 111, ?)').run('g2', 'world\x1fthế giới')
  db.exec('insert into cards values (1, 1, 42), (2, 2, 42)')
  const collection = db.serialize()
  db.close()
  return zipSync({
    'collection.anki2': collection,
    media: strToU8(JSON.stringify({ '0': 'hello.mp3' })),
    '0': AUDIO,
  })
}

/** varint + trường protobuf, đủ dựng MediaEntries cho test */
function varint(n: number) {
  const out: number[] = []
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  out.push(n)
  return out
}
const lenField = (field: number, bytes: Uint8Array | number[]) => [
  ...varint((field << 3) | 2),
  ...varint(bytes.length),
  ...bytes,
]

/** gói kiểu mới: collection.anki21b nén zstd, bảng notetypes/fields, media protobuf */
function modernApkg() {
  const db = new Database(':memory:')
  db.exec(`
    create table notetypes (id integer, name text);
    create table fields (ntid integer, ord integer, name text);
    create table decks (id integer, name text);
    create table notes (id integer, guid text, mid integer, flds text);
    create table cards (id integer, nid integer, did integer);
    insert into notetypes values (222, 'Vocab'), (333, 'Unused');
    insert into fields values (222, 0, 'Word'), (222, 1, 'Meaning'), (222, 2, 'Audio');
    insert into decks values (7, 'IELTS' || char(31) || 'Band 7');
    insert into notes values (1, 'n1', 222, 'abandon' || char(31) || 'từ bỏ' || char(31) || '[sound:abandon.mp3]');
    insert into cards values (1, 1, 7);
  `)
  const collection = zstdCompressSync(db.serialize())
  db.close()
  const entry = (name: string) => lenField(1, strToU8(name))
  const media = new Uint8Array([
    ...lenField(1, entry('other.mp3')),
    ...lenField(1, entry('abandon.mp3')),
  ])
  return zipSync({
    'collection.anki21b': new Uint8Array(collection),
    // bản mới vẫn kèm collection.anki2 giả ("hãy cập nhật Anki") → phải bỏ qua
    'collection.anki2': new Uint8Array([0]),
    media: new Uint8Array(zstdCompressSync(media)),
    '0': new Uint8Array([9]),
    '1': new Uint8Array(zstdCompressSync(AUDIO)),
  })
}

describe('readApkg', () => {
  it('đọc gói kiểu cũ: field theo ord, tên deck, media JSON', () => {
    const pkg = readApkg(legacyApkg())
    expect(pkg.deckName).toBe('English::Words')
    expect(pkg.notetypes).toHaveLength(1)
    const [type] = pkg.notetypes
    expect(type.fields).toEqual(['Front', 'Back'])
    expect(type.noteCount).toBe(2)
    expect(type.samples[0]).toEqual(['hello', 'xin chào bạn\nlời chào'])
    expect(type.soundFields).toEqual([0])
    expect(pkg.notes[0]).toMatchObject({ guid: 'g1', notetypeId: '111' })
    expect([...pkg.media(['hello.mp3', 'missing.mp3'])]).toEqual([['hello.mp3', AUDIO]])
  })

  it('đọc gói anki21b: zstd, bảng notetypes, media protobuf, bỏ note type rỗng', () => {
    const pkg = readApkg(modernApkg())
    expect(pkg.deckName).toBe('IELTS::Band 7')
    expect(pkg.notetypes.map((t) => t.name)).toEqual(['Vocab'])
    expect(pkg.notetypes[0].fields).toEqual(['Word', 'Meaning', 'Audio'])
    expect(pkg.notetypes[0].samples[0]).toEqual(['abandon', 'từ bỏ', ''])
    expect(pkg.notetypes[0].soundFields).toEqual([2])
    expect(pkg.media(['abandon.mp3']).get('abandon.mp3')).toEqual(AUDIO)
  })

  it('báo lỗi khi không phải gói Anki', () => {
    expect(() => readApkg(zipSync({ 'a.txt': strToU8('x') }))).toThrow(/Anki/)
  })
})

describe('parseMediaMap', () => {
  it('ưu tiên legacy_zip_filename nếu có', () => {
    const entry = [...lenField(1, strToU8('a.mp3')), ...varint((255 << 3) | 0), ...varint(5)]
    const map = parseMediaMap(new Uint8Array(zstdCompressSync(new Uint8Array(lenField(1, entry)))))
    expect(map.get('a.mp3')).toBe('5')
  })
})

describe('cleanField', () => {
  it('tách [sound:], bỏ thẻ HTML, giải mã entity', () => {
    expect(cleanField('<div>a&amp;b&#39;s</div><div>c [sound:x y.mp3]</div>')).toEqual({
      text: "a&b's\nc",
      sounds: ['x y.mp3'],
    })
  })
})
