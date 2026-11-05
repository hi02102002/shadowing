import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApkg } from './export.ts'
import { readApkg } from './apkg.ts'
import type { ExportCard } from './export.ts'

// không gọi mạng thật (cả giọng đọc dùng node:https)
vi.mock('../tts-route.ts', () => ({
  speechMp3: () => Promise.reject(new Error('offline')),
}))

// không gọi mạng thật: ảnh/audio tự tạo (Bing, Youdao) thất bại → thẻ vẫn xuất, thiếu media
beforeEach(() =>
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))),
)
afterEach(() => vi.unstubAllGlobals())

const card = (over: Partial<ExportCard>): ExportCard => ({
  front: 'apple',
  back: 'quả táo',
  ipa: null,
  example: null,
  extra: null,
  meaningVi: null,
  info: null,
  imageUrl: null,
  audioUrl: null,
  audioFile: null,
  guid: null,
  ...over,
})

describe('buildApkg', () => {
  it('xuất gói đọc lại được bằng readApkg, giữ đủ trường và escape HTML', async () => {
    const zip = await buildApkg([
      {
        name: 'Deck <1>',
        cards: [
          card({
            guid: 'g1',
            ipa: 'ˈæp.əl',
            example: 'It is <red>.',
            meaningVi: 'quả táo',
          }),
          // ảnh/audio không đọc được → thẻ vẫn xuất, thiếu media
          card({
            front: 'pear',
            back: 'quả lê',
            guid: 'g2',
            imageUrl: '/api/essential-media/nope/x/y.jpg',
          }),
        ],
      },
    ])
    const pkg = readApkg(zip)
    expect(pkg.notes).toHaveLength(2)
    expect(pkg.notetypes[0].fields).toEqual(['Front', 'Back'])
    const [a, b] = pkg.notes
    expect(a.guid).toBe('g1')
    // mặt trước: badge loại từ + từ; mặt sau: IPA, nghĩa Việt, ví dụ (đã escape HTML)
    expect(a.fields[0]).toContain('Danh từ • n.')
    expect(a.fields[0]).toContain('<div class="anki-word">apple</div>')
    expect(a.fields[1]).toContain('ˈæp.əl')
    expect(a.fields[1]).toContain('<b>🇻🇳</b> quả táo')
    expect(a.fields[1]).toContain('It is &lt;red&gt;.')
    expect(b.fields[0]).not.toContain('<img')
  })

  it('thẻ ghi chú dùng khung Language Note, cụm nhiều từ có badge Cụm từ', async () => {
    const zip = await buildApkg([
      {
        name: 'D',
        cards: [
          card({
            front: 'Common mistakes · A',
            back: 'line <1>\nline 2',
            guid: 'eenote:x:1:0',
          }),
          card({
            front: 'nowhere to park',
            back: 'no place',
            info: {
              pos: null,
              examples: [{ en: 'I could not park.', vi: 'Tôi không đỗ được.' }],
              collocations: [],
              idioms: [
                { en: 'find nowhere to park', vi: 'không tìm được chỗ đỗ' },
              ],
              family: [],
              synonyms: [],
            },
          }),
        ],
      },
    ])
    const [note, phrase] = readApkg(zip).notes
    expect(note.fields[1]).toContain('LANGUAGE NOTE')
    expect(note.fields[1]).toContain('line &lt;1&gt;')
    expect(phrase.fields[0]).toContain('Cụm từ • phr.')
    expect(phrase.fields[1]).toContain('Lexical Chunks')
    expect(phrase.fields[1]).toContain('find nowhere to park')
    expect(phrase.fields[1]).toContain('Tôi không đỗ được.')
  })
})

describe('buildApkg — deck lồng nhau', () => {
  it('tạo deck cha và deck con, mỗi thẻ thuộc đúng deck', async () => {
    const zip = await buildApkg([
      { name: 'Book::Unit 1', cards: [card({ guid: 'a' })] },
      { name: 'Book::Unit 2', cards: [card({ front: 'pear', guid: 'b' })] },
    ])
    const pkg = readApkg(zip)
    expect(pkg.notes).toHaveLength(2)
    const { unzipSync } = await import('fflate')
    const Database = (await import('better-sqlite3')).default
    const db = new Database(Buffer.from(unzipSync(zip)['collection.anki2']))
    const col = db.prepare('select decks from col').get() as { decks: string }
    const names = Object.values(
      JSON.parse(col.decks) as Record<string, { name: string }>,
    ).map((d) => d.name)
    expect(names.sort()).toEqual(['Book', 'Book::Unit 1', 'Book::Unit 2'])
    expect(
      (
        db.prepare('select count(distinct did) n from cards').get() as {
          n: number
        }
      ).n,
    ).toBe(2)
    db.close()
  })
})
