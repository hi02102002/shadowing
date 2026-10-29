import { createServerFn } from '@tanstack/react-start'
import { like, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { cards, decks } from '#/db/schema.ts'
import { VOCAB_BOOKS, findBook } from '../essential/books.ts'
import { loadBook } from '../essential/vocab.ts'

const SOURCE = 'essential'

/** slug sách → bộ thẻ đang chứa thẻ của sách đó (anki_guid dạng ee:<slug>:…), vẫn đúng khi đổi tên bộ */
function deckBySlug() {
  const rows = db
    .select({
      deckId: cards.deckId,
      slug: sql<string>`substr(${cards.ankiGuid}, 4, instr(substr(${cards.ankiGuid}, 4), ':') - 1)`,
    })
    .from(cards)
    .where(like(cards.ankiGuid, 'ee:%'))
    .groupBy(sql`1, 2`)
    .all()
  return new Map(rows.map((r) => [r.slug, r.deckId]))
}

const guidsOf = (slug: string) =>
  new Set(
    db
      .select({ guid: cards.ankiGuid })
      .from(cards)
      .where(like(cards.ankiGuid, `ee:${slug}:%`))
      .all()
      .map((r) => r.guid),
  )

export const listEssentialBooks = createServerFn({ method: 'GET' }).handler(async () => {
  const decksOf = deckBySlug()
  return VOCAB_BOOKS.map((b) => ({
    slug: b.slug,
    title: b.title,
    series: b.series,
    deckId: decksOf.get(b.slug) ?? null,
  }))
})

export type EssentialBookRow = Awaited<ReturnType<typeof listEssentialBooks>>[number]

/** danh sách unit để chọn import, kèm số từ đã có trong bộ thẻ */
export const getEssentialBook = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const units = await loadBook(data.slug)
    const have = guidsOf(data.slug)
    return units.map((u) => ({
      index: u.index,
      title: u.title,
      total: u.words.length,
      imported: u.words.filter((w) => have.has(w.guid)).length,
      preview: u.words.slice(0, 5).map((w) => w.word),
    }))
  })

export type EssentialUnitRow = Awaited<ReturnType<typeof getEssentialBook>>[number]

/** thêm các unit đã chọn vào bộ thẻ của sách (tạo bộ nếu chưa có); từ đã có thì bỏ qua */
export const importEssentialBook = createServerFn({ method: 'POST' })
  .validator(z.object({ slug: z.string(), units: z.array(z.number().int().min(0)).min(1) }))
  .handler(async ({ data }) => {
    const book = findBook(data.slug)
    if (!book) throw new Error('Không có sách từ vựng này')
    const want = new Set(data.units)
    const units = (await loadBook(data.slug)).filter((u) => want.has(u.index))

    const deckId =
      deckBySlug().get(book.slug) ??
      db.insert(decks).values({ name: book.title, source: SOURCE }).returning({ id: decks.id }).get().id

    let added = 0
    let skipped = 0
    // thẻ mới học theo thứ tự id → chèn theo thứ tự unit trong sách
    db.transaction((tx) => {
      for (const u of units) {
        for (const w of u.words) {
          const row = tx
            .insert(cards)
            .values({
              deckId,
              front: w.word,
              // English Vocabulary in Use không có định nghĩa → mặt sau là chủ đề của unit
              back: w.definition || u.title,
              ipa: w.ipa,
              example: w.example,
              extra: [w.pos, w.definition ? u.title : null].filter(Boolean).join(' · ') || null,
              imageUrl: w.imageUrl,
              audioUrl: w.audioUrl,
              ankiGuid: w.guid,
            })
            .onConflictDoNothing()
            .returning({ id: cards.id })
            .get() as { id: number } | undefined
          if (row) added++
          else skipped++
        }
      }
    })
    return { deckId, added, skipped }
  })
