/**
 * Xuất một bộ thẻ ra gói Anki (.apkg): zip gồm collection.anki2 (SQLite, schema cũ nên Anki bản nào cũng mở được),
 * media (JSON "0" → tên file) và các file media đánh số 0, 1, 2…
 * Lịch ôn FSRS không xuất, thẻ vào Anki như thẻ mới.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import { zipSync } from 'fflate'

import { cardMediaDir } from '../media-store.ts'
import { getEssentialMedia } from '../essential-media-route.ts'
import { bingImageUrl } from '#/lib/anki-builder.ts'
import {
  CARD_CSS,
  audioButton,
  escapeHtml,
  renderCard,
} from './card-template.ts'
import { mediaDownloader, speech } from './media.ts'
import type { CardInfo } from '#/db/schema.ts'

export interface ExportCard {
  front: string
  back: string
  ipa: string | null
  example: string | null
  extra: string | null
  meaningVi: string | null
  info: CardInfo | null
  imageUrl: string | null
  audioUrl: string | null
  audioFile: string | null
  guid: string | null
}

const FIELDS = ['Front', 'Back']
const SEP = '\x1f'

/** 32-bit không dấu từ sha1 — dùng làm csum/guid/id số theo kiểu Anki */
const hash32 = (s: string) =>
  parseInt(createHash('sha1').update(s).digest('hex').slice(0, 8), 16)

/** nội dung file media theo URL trong app; null khi không đọc được (thẻ vẫn xuất, chỉ thiếu media) */
async function loadMedia(
  url: string,
): Promise<{ name: string; data: Uint8Array } | null> {
  const essential = /^\/api\/essential-media\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(
    url,
  )
  if (essential) {
    const m = await getEssentialMedia(
      essential[1],
      essential[2],
      decodeURIComponent(essential[3]),
    )
    // tên có slug để file của các sách khác nhau không đè nhau
    return m
      ? {
          name: `ee-${essential[1]}-${essential[2]}-${m.name}`.replace(
            /[^\w.-]/g,
            '_',
          ),
          data: m.data,
        }
      : null
  }
  const local = /^\/api\/card-media\/([^/]+)$/.exec(url)
  if (local) {
    const name = path.basename(decodeURIComponent(local[1]))
    const data = await fs
      .readFile(path.join(cardMediaDir(), name))
      .catch(() => null)
    return data ? { name, data } : null
  }
  return null
}

export interface ExportDeck {
  /** tên deck, "::" tạo deck lồng nhau kiểu Anki, vd. "Sách::Unit 1" */
  name: string
  cards: ExportCard[]
}

const first = (s: string | null | undefined) => s?.split('\n')[0].trim() ?? ''

/**
 * Xuất các deck. Thẻ chưa có ảnh/audio thì tự tạo như trình tạo thẻ Anki: ảnh Bing theo từ,
 * giọng Youdao (UK) cho từ, câu ví dụ và thành ngữ. Media đã có trong app (sách, import Anki) dùng lại.
 */
export async function buildApkg(
  exportDecks: ExportDeck[],
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const media = new Map<string, Uint8Array>()
  const download = mediaDownloader()
  const addFile = (name: string, data: Uint8Array) => {
    media.set(name, data)
    return name
  }
  /** URL trong app (/api/…) đọc từ đĩa, URL ngoài tải về; trả về tên file trong gói hoặc null */
  const fetchMedia = async (url: string | null, ext: string) => {
    if (!url) return null
    if (url.startsWith('/')) {
      const m = await loadMedia(url).catch(() => null)
      return m ? addFile(m.name, m.data) : null
    }
    const d = await download(url, ext)
    return d
      ? addFile(`gen-${hash32(url).toString(16)}.${d.ext}`, d.data)
      : null
  }
  /** audio giọng đọc của text, dùng chung file nếu cùng nội dung */
  const tts = async (text: string) => {
    const d = await speech(text)
    return d
      ? addFile(`tts-${hash32(text.toLowerCase()).toString(16)}.mp3`, d.data)
      : null
  }
  const sound = (name: string | null) => (name ? `[sound:${name}]` : '')

  const jobs = exportDecks.flatMap((d) =>
    d.cards.map((c) => ({ deck: d.name, c })),
  )
  const rows: ApkgRow[] = new Array(jobs.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++
      const { deck, c } = jobs[i]
      const isNote = c.guid?.startsWith('eenote:') ?? false
      let imageTag = ''
      let audioTag = ''
      let exampleSound = ''
      let chunkSounds: string[] = []
      if (!isNote) {
        const word = c.front.trim()
        const exampleText = first(c.example) || c.info?.examples[0]?.en || ''
        // thứ tự giống khung chunks của thẻ (thành ngữ rồi collocation, tối đa 5 dòng); collocation là danh sách từ → đọc câu ví dụ của nó
        const chunkTexts = [
          ...(c.info?.idioms ?? []).map((x) => x.en),
          ...(c.info?.collocations ?? []).map(
            (k) => k.example || k.words.split(/[,|]/)[0].trim(),
          ),
        ].slice(0, 5)
        const [image, audio, example, chunks] = await Promise.all([
          (async () =>
            (await fetchMedia(c.imageUrl, 'jpg')) ??
            (await fetchMedia(bingImageUrl(word), 'jpg')) ??
            (await fetchMedia(bingImageUrl(word, true), 'jpg')))(),
          (async () =>
            (await fetchMedia(
              c.audioUrl ??
                (c.audioFile
                  ? `/api/card-media/${encodeURIComponent(c.audioFile)}`
                  : null),
              'mp3',
            )) ?? (await tts(word)))(),
          exampleText ? tts(exampleText) : null,
          Promise.all(chunkTexts.map((t) => (t ? tts(t) : null))),
        ])
        if (image)
          imageTag = `<img src="${escapeHtml(image)}" alt="${escapeHtml(word)}" style="max-height:220px;max-width:100%;object-fit:cover;border-radius:8px">`
        audioTag = sound(audio)
        exampleSound = audioButton(example)
        chunkSounds = chunks.map(audioButton)
      }
      const html = renderCard(
        { ...c, isNote },
        { imageTag, audioTag, exampleSound, chunkSounds },
      )
      rows[i] = {
        deck,
        guid: c.guid ?? `shadowing:${c.front}`,
        fields: [html.front, html.back],
        sort: c.front,
        tags: html.tags,
      }
      onProgress?.(++done, jobs.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, jobs.length) }, worker))

  return writeApkg(rows, media)
}

export interface ApkgRow {
  /** tên deck, "::" tạo deck lồng nhau */
  deck: string
  guid: string
  /** [mặt trước, mặt sau] dạng HTML */
  fields: string[]
  sort: string
  tags: string[]
}

/** ghi gói .apkg từ các note đã dựng sẵn HTML + file media (tên file → nội dung) */
export function writeApkg(
  rows: ApkgRow[],
  media: Map<string, Uint8Array>,
): Uint8Array {
  const now = Math.floor(Date.now() / 1000)
  const deckId = now * 1000
  const modelId = deckId + 1

  // deck cha (phần trước "::") cũng phải có trong collection để Anki hiện đúng cây
  const deckIds = new Map<string, number>()
  for (const r of rows) {
    const parts = r.deck.split('::')
    for (let i = 1; i <= parts.length; i++) {
      const name = parts.slice(0, i).join('::')
      if (!deckIds.has(name)) deckIds.set(name, deckId + 1000 + deckIds.size)
    }
  }
  if (!deckIds.size) deckIds.set('Deck', deckId + 1000)

  const db = new Database(':memory:')
  try {
    db.exec(`
      CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
      CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
      CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
      CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
      CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
      CREATE INDEX ix_notes_usn on notes (usn);
      CREATE INDEX ix_cards_usn on cards (usn);
      CREATE INDEX ix_revlog_usn on revlog (usn);
      CREATE INDEX ix_cards_nid on cards (nid);
      CREATE INDEX ix_cards_sched on cards (did, queue, due);
      CREATE INDEX ix_revlog_cid on revlog (cid);
      CREATE INDEX ix_notes_csum on notes (csum);
    `)

    const model = {
      id: modelId,
      name: 'Shadowing Vocabulary v2',
      type: 0,
      mod: now,
      usn: -1,
      sortf: 0,
      did: [...deckIds.values()][0],
      tmpls: [
        {
          name: 'Card 1',
          ord: 0,
          qfmt: '{{Front}}',
          afmt: '{{FrontSide}}<hr id="answer">{{Back}}',
          bqfmt: '',
          bafmt: '',
          did: null,
          bfont: '',
          bsize: 0,
        },
      ],
      flds: FIELDS.map((name, ord) => ({
        name,
        ord,
        sticky: false,
        rtl: false,
        font: 'Arial',
        size: 20,
        media: [],
      })),
      css: CARD_CSS,
      latexPre: '',
      latexPost: '',
      latexsvg: false,
      req: [[0, 'any', [0]]],
      tags: [],
      vers: [],
    }
    const mkDeck = (name: string, id: number) => ({
      id,
      name,
      mod: now,
      usn: -1,
      desc: '',
      dyn: 0,
      collapsed: false,
      conf: 1,
      lrnToday: [0, 0],
      newToday: [0, 0],
      revToday: [0, 0],
      timeToday: [0, 0],
      extendNew: 0,
      extendRev: 0,
    })
    const firstDeck = [...deckIds.values()][0]
    const decksJson = Object.fromEntries(
      [...deckIds].map(([name, id]) => [id, mkDeck(name, id)]),
    )
    const conf = {
      activeDecks: [firstDeck],
      curDeck: firstDeck,
      newSpread: 0,
      collapseTime: 1200,
      timeLim: 0,
      estTimes: true,
      dueCounts: true,
      curModel: modelId,
      nextPos: rows.length + 1,
      sortType: 'noteFld',
      sortBackwards: false,
      addToCur: true,
    }
    const dconf = {
      1: {
        id: 1,
        name: 'Default',
        mod: 0,
        usn: 0,
        maxTaken: 60,
        autoplay: true,
        timer: 0,
        replayq: true,
        new: {
          bury: false,
          delays: [1, 10],
          initialFactor: 2500,
          ints: [1, 4, 7],
          order: 1,
          perDay: 20,
        },
        rev: {
          bury: false,
          ease4: 1.3,
          ivlFct: 1,
          maxIvl: 36500,
          perDay: 200,
          hardFactor: 1.2,
        },
        lapse: {
          delays: [10],
          leechAction: 1,
          leechFails: 8,
          minInt: 1,
          mult: 0,
        },
      },
    }
    db.prepare(
      'INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)',
    ).run(
      now,
      now * 1000,
      now * 1000,
      JSON.stringify(conf),
      JSON.stringify({ [modelId]: model }),
      JSON.stringify(decksJson),
      JSON.stringify(dconf),
      '{}',
    )

    const insertNote = db.prepare(
      'INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, ?)',
    )
    const insertCard = db.prepare(
      'INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?)',
    )
    db.transaction(() => {
      rows.forEach((r, i) => {
        const id = deckId + i + 10
        const sortField = r.sort
        insertNote.run(
          id,
          r.guid,
          modelId,
          now,
          r.tags.length ? ` ${r.tags.join(' ')} ` : '',
          r.fields.join(SEP),
          sortField,
          hash32(sortField),
          '',
        )
        insertCard.run(id, id, deckIds.get(r.deck)!, now, i + 1, '')
      })
    })()

    const files: Record<string, Uint8Array> = {
      'collection.anki2': new Uint8Array(db.serialize()),
    }
    const map: Record<string, string> = {}
    let n = 0
    for (const [name, data] of media) {
      files[String(n)] = data
      map[String(n)] = name
      n++
    }
    files.media = new TextEncoder().encode(JSON.stringify(map))
    // mp3/jpg đã nén sẵn → không nén lại
    return zipSync(files, { level: 0 })
  } finally {
    db.close()
  }
}
