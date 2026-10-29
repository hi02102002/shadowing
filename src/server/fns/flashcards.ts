import fs from 'node:fs'
import path from 'node:path'
import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, gte, lte, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { cards, decks, reviewLogs, segments, videos } from '#/db/schema.ts'
import type { Card } from '#/db/schema.ts'
import { cleanField, readApkg } from '../anki/apkg.ts'
import { getConfig } from '../config.ts'
import { cleanWord, contextLookup, dictionaryLookup } from '../lookup.ts'
import { cardMediaDir, findUpload, removeUpload } from '../media-store.ts'
import { previewIntervals, review } from '../srs.ts'


const TRANSCRIPT_DECK = 'Từ vựng từ video'
/** số thẻ mới tối đa mỗi ngày (giống mặc định của Anki) */
const NEW_PER_DAY = 20
const QUEUE_LIMIT = 200

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const listDecks = createServerFn({ method: 'GET' }).handler(async () => {
  const now = new Date()
  return db
    .select({
      id: decks.id,
      name: decks.name,
      source: decks.source,
      total: sql<number>`count(${cards.id})`,
      newCount: sql<number>`coalesce(sum(${cards.state} = 0), 0)`,
      dueCount: sql<number>`coalesce(sum(${cards.state} != 0 and ${cards.due} <= ${Math.floor(now.getTime() / 1000)}), 0)`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .groupBy(decks.id)
    .orderBy(asc(decks.createdAt), asc(decks.id))
    .all()
})

export type DeckRow = Awaited<ReturnType<typeof listDecks>>[number]

export const listCards = createServerFn({ method: 'GET' })
  .validator(z.object({ deckId: z.number().int() }))
  .handler(async ({ data }) =>
    db
      .select({
        id: cards.id,
        front: cards.front,
        back: cards.back,
        meaningVi: cards.meaningVi,
        ipa: cards.ipa,
        sentence: cards.sentence,
        state: cards.state,
        due: cards.due,
        reps: cards.reps,
        lapses: cards.lapses,
        createdAt: cards.createdAt,
      })
      .from(cards)
      .where(eq(cards.deckId, data.deckId))
      .orderBy(asc(cards.id))
      .all(),
  )

export type CardRow = Awaited<ReturnType<typeof listCards>>[number]

function removeAudio(files: (string | null)[]) {
  for (const f of files) if (f) fs.rmSync(path.join(cardMediaDir(), path.basename(f)), { force: true })
}

export const deleteCard = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const row = db.select({ audioFile: cards.audioFile }).from(cards).where(eq(cards.id, data.id)).get()
    db.delete(cards).where(eq(cards.id, data.id)).run()
    removeAudio([row?.audioFile ?? null])
    return { ok: true }
  })

export const deleteDeck = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const files = db
      .select({ audioFile: cards.audioFile })
      .from(cards)
      .where(eq(cards.deckId, data.id))
      .all()
      .map((r) => r.audioFile)
    db.delete(decks).where(eq(decks.id, data.id)).run()
    removeAudio(files)
    return { ok: true }
  })

export const renameDeck = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int(), name: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) => {
    db.update(decks).set({ name: data.name }).where(eq(decks.id, data.id)).run()
    return { ok: true }
  })

/** Tạo bộ thẻ trống do người dùng tự đặt tên */
export const createDeck = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) =>
    db.insert(decks).values({ name: data.name, source: 'custom' }).returning({ id: decks.id }).get(),
  )

/** bộ mặc định khi không chọn bộ nào: tạo lúc lưu từ đầu tiên */
const defaultDeckId = () =>
  db.select({ id: decks.id }).from(decks).where(eq(decks.source, 'transcript')).orderBy(asc(decks.id)).get()?.id ??
  db.insert(decks).values({ name: TRANSCRIPT_DECK, source: 'transcript' }).returning({ id: decks.id }).get().id

const findCard = (deckId: number, front: string) =>
  db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.deckId, deckId), sql`lower(${cards.front}) = ${front.toLowerCase()}`))
    .get()

/** id các bộ đã có từ này (để thẻ tra từ hiện "Đã lưu" theo bộ đang chọn) */
export const savedDecks = createServerFn({ method: 'POST' })
  .validator(z.object({ text: z.string().trim().min(1).max(80) }))
  .handler(async ({ data }) =>
    db
      .selectDistinct({ deckId: cards.deckId })
      .from(cards)
      .where(sql`lower(${cards.front}) = ${cleanWord(data.text).toLowerCase()}`)
      .all()
      .map((r) => r.deckId),
  )

/** Bỏ từ khỏi một bộ (nút "Đã lưu" trong thẻ tra từ bấm lần nữa) */
export const removeWordCard = createServerFn({ method: 'POST' })
  .validator(z.object({ text: z.string().trim().min(1).max(80), deckId: z.number().int() }))
  .handler(async ({ data }) => {
    const where = and(
      eq(cards.deckId, data.deckId),
      sql`lower(${cards.front}) = ${cleanWord(data.text).toLowerCase()}`,
    )
    const files = db.select({ audioFile: cards.audioFile }).from(cards).where(where).all()
    db.delete(cards).where(where).run()
    removeAudio(files.map((f) => f.audioFile))
    return { ok: true }
  })

/** Thêm thẻ bằng tay vào một bộ */
export const addCard = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      deckId: z.number().int(),
      front: z.string().trim().min(1).max(200),
      back: z.string().trim().max(2000),
      ipa: z.string().trim().max(120).optional(),
      example: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ data }) =>
    db
      .insert(cards)
      .values({
        deckId: data.deckId,
        front: data.front,
        back: data.back,
        ipa: data.ipa || null,
        example: data.example || null,
      })
      .returning({ id: cards.id })
      .get(),
  )

/** Lưu từ/cụm từ đang tra thành thẻ (vào bộ được chọn, mặc định bộ "Từ vựng từ video"), kèm câu và đoạn video; lưu lại cùng từ trong cùng bộ thì cập nhật thẻ cũ */
export const saveWordCard = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      text: z.string().trim().min(1).max(80),
      sentence: z.string().max(600),
      segmentId: z.number().int().nullable(),
      startMs: z.number().int(),
      endMs: z.number().int(),
      deckId: z.number().int().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const front = cleanWord(data.text)
    if (!front) throw new Error('Không có từ để lưu')
    const deckId =
      data.deckId != null && db.select({ id: decks.id }).from(decks).where(eq(decks.id, data.deckId)).get()
        ? data.deckId
        : defaultDeckId()

    // thẻ tra từ vừa gọi hai nguồn này nên thường đã có sẵn trong cache
    const [ai, dict] = await Promise.all([
      contextLookup(front, data.sentence).catch(() => null),
      dictionaryLookup(front).catch(() => null),
    ])
    const accent = getConfig().accent
    const dictMeaning = dict?.senses
      .filter((s) => !s.specialized)
      .slice(0, 2)
      .map((s) => (s.kind ? `(${s.kind}) ` : '') + s.means.slice(0, 3).join('; '))
      .join('\n')
    const content = {
      back: ai?.meaningInContext || dictMeaning || '',
      ipa:
        (accent === 'uk' ? ai?.ipa || dict?.ipaUk : ai?.ipaUs || dict?.ipaUs) ||
        ai?.ipa ||
        dict?.ipaUk ||
        null,
      example: ai?.examples[0] ? `${ai.examples[0].en}\n${ai.examples[0].vi}` : null,
      extra:
        [
          ai?.partOfSpeech,
          ai?.definitionEn,
          ai?.otherMeanings.length ? `Nghĩa khác: ${ai.otherMeanings.join('; ')}` : '',
          ai && dictMeaning ? dictMeaning : '',
        ]
          .filter(Boolean)
          .join('\n') || null,
      segmentId: data.segmentId,
      sentence: data.sentence || null,
      clipStartMs: data.startMs,
      clipEndMs: data.endMs,
    }

    const existing = findCard(deckId, front)
    if (existing) {
      db.update(cards).set(content).where(eq(cards.id, existing.id)).run()
      return { id: existing.id, deckId, created: false }
    }
    const row = db
      .insert(cards)
      .values({ deckId, front, ...content })
      .returning({ id: cards.id })
      .get()
    return { id: row.id, deckId, created: true }
  })

const studySelect = {
  card: cards,
  youtubeId: videos.youtubeId,
  segmentIdx: segments.idx,
}

function withIntervals(r: { card: Card; youtubeId: string | null; segmentIdx: number | null }) {
  return { ...r.card, youtubeId: r.youtubeId, segmentIdx: r.segmentIdx, intervals: previewIntervals(r.card) }
}

export type StudyCard = ReturnType<typeof withIntervals>

/** Hàng đợi học: thẻ đang học/học lại → thẻ ôn đến hạn → thẻ mới (giới hạn mỗi ngày) */
export const studyQueue = createServerFn({ method: 'GET' })
  .validator(z.object({ deckId: z.number().int().optional() }))
  .handler(async ({ data }) => {
    const now = new Date()
    const inDeck = data.deckId == null ? undefined : eq(cards.deckId, data.deckId)
    const base = () =>
      db
        .select(studySelect)
        .from(cards)
        .leftJoin(segments, eq(segments.id, cards.segmentId))
        .leftJoin(videos, eq(videos.id, segments.videoId))

    const due = base()
      .where(and(inDeck, ne(cards.state, 0), lte(cards.due, now)))
      // learning/relearning (1, 3) trước review (2)
      .orderBy(sql`${cards.state} = 2`, asc(cards.due))
      .limit(QUEUE_LIMIT)
      .all()

    const newToday = db
      .select({ n: sql<number>`count(*)` })
      .from(reviewLogs)
      .innerJoin(cards, eq(cards.id, reviewLogs.cardId))
      .where(and(inDeck, eq(reviewLogs.state, 0), gte(reviewLogs.reviewedAt, startOfToday())))
      .get()!.n
    const newLimit = Math.max(0, Math.min(NEW_PER_DAY - newToday, QUEUE_LIMIT - due.length))
    const fresh = newLimit
      ? base().where(and(inDeck, eq(cards.state, 0))).orderBy(asc(cards.id)).limit(newLimit).all()
      : []

    return [...due, ...fresh].map(withIntervals)
  })

/** Chấm điểm một thẻ (1 Again | 2 Hard | 3 Good | 4 Easy), trả thẻ đã cập nhật lịch */
export const reviewCard = createServerFn({ method: 'POST' })
  .validator(z.object({ cardId: z.number().int(), rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) }))
  .handler(async ({ data }) => {
    const row = db.select().from(cards).where(eq(cards.id, data.cardId)).get()
    if (!row) throw new Error('Không tìm thấy thẻ')
    const { fields, log } = review(row, data.rating)
    db.transaction((tx) => {
      tx.update(cards).set(fields).where(eq(cards.id, row.id)).run()
      tx.insert(reviewLogs)
        .values({
          cardId: row.id,
          rating: log.rating,
          state: log.state,
          due: log.due,
          stability: log.stability,
          difficulty: log.difficulty,
          elapsedDays: log.elapsed_days,
          reviewedAt: log.review,
        })
        .run()
    })
    const updated = db
      .select(studySelect)
      .from(cards)
      .leftJoin(segments, eq(segments.id, cards.segmentId))
      .leftJoin(videos, eq(videos.id, segments.videoId))
      .where(eq(cards.id, row.id))
      .get()!
    return withIntervals(updated)
  })

// ---- Import Anki (.apkg) ----

async function loadPackage(uploadId: string) {
  const file = await findUpload(uploadId)
  if (!file) throw new Error('File upload đã hết hạn, hãy chọn lại file')
  return readApkg(new Uint8Array(await fs.promises.readFile(file)))
}

export const inspectAnkiPackage = createServerFn({ method: 'POST' })
  .validator(z.object({ uploadId: z.string() }))
  .handler(async ({ data }) => {
    const pkg = await loadPackage(data.uploadId)
    return { deckName: pkg.deckName, notetypes: pkg.notetypes }
  })

export type AnkiInspect = Awaited<ReturnType<typeof inspectAnkiPackage>>

const FieldIndex = z.number().int().min(0).nullable()
const MappingSchema = z.object({
  front: z.number().int().min(0),
  back: z.number().int().min(0),
  ipa: FieldIndex,
  example: FieldIndex,
  extra: FieldIndex,
  audio: FieldIndex,
})

export type AnkiMapping = z.infer<typeof MappingSchema>

const safeName = (name: string) => path.basename(name).replace(/[^\w.-]+/g, '_').slice(-80)

export const importAnkiPackage = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      uploadId: z.string(),
      deckName: z.string().trim().min(1).max(120),
      /** notetypeId → cách map trường; null = bỏ qua note type đó */
      mappings: z.record(z.string(), MappingSchema.nullable()),
    }),
  )
  .handler(async ({ data }) => {
    const pkg = await loadPackage(data.uploadId)
    // import lại vào deck cùng tên → anki_guid giúp bỏ qua note đã có
    const deckId =
      db
        .select({ id: decks.id })
        .from(decks)
        .where(and(eq(decks.name, data.deckName), eq(decks.source, 'anki')))
        .get()?.id ??
      db.insert(decks).values({ name: data.deckName, source: 'anki' }).returning({ id: decks.id }).get().id

    const pick = (fields: string[], i: number | null) => (i == null ? null : cleanField(fields[i] ?? ''))
    const audioOf = new Map<number, string>()
    let added = 0
    let skipped = 0

    db.transaction((tx) => {
      for (const note of pkg.notes) {
        const map = data.mappings[note.notetypeId]
        if (!map) continue
        const front = pick(note.fields, map.front)!
        const back = pick(note.fields, map.back)!
        if (!front.text) {
          skipped++
          continue
        }
        const audio =
          pick(note.fields, map.audio)?.sounds.at(0) ?? front.sounds.at(0) ?? back.sounds.at(0) ?? null
        const row = tx
          .insert(cards)
          .values({
            deckId,
            front: front.text,
            back: back.text,
            ipa: pick(note.fields, map.ipa)?.text || null,
            example: pick(note.fields, map.example)?.text || null,
            extra: pick(note.fields, map.extra)?.text || null,
            ankiGuid: note.guid,
          })
          .onConflictDoNothing()
          .returning({ id: cards.id })
          // trùng anki_guid → không insert, get() trả undefined
          .get() as { id: number } | undefined
        if (!row) {
          skipped++
          continue
        }
        added++
        if (audio) audioOf.set(row.id, audio)
      }
    })

    if (audioOf.size) {
      fs.mkdirSync(cardMediaDir(), { recursive: true })
      const files = pkg.media([...new Set(audioOf.values())])
      const saved: { id: number; file: string }[] = []
      for (const [id, name] of audioOf) {
        const bytes = files.get(name)
        if (!bytes) continue
        const file = `${id}-${safeName(name)}`
        fs.writeFileSync(path.join(cardMediaDir(), file), bytes)
        saved.push({ id, file })
      }
      db.transaction((tx) => {
        for (const s of saved) tx.update(cards).set({ audioFile: s.file }).where(eq(cards.id, s.id)).run()
      })
    }

    await removeUpload(data.uploadId)
    return { deckId, added, skipped }
  })
