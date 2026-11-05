import { createServerFn } from '@tanstack/react-start'
import { like, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { cards } from '#/db/schema.ts'
import { getConfig } from '../config.ts'
import { VOCAB_BOOKS, findBook } from '../essential/books.ts'
import { groupDeck, splitBookDecks } from '../essential/decks.ts'
import { enrichCardById } from '../essential/enrich.ts'
import { unitGroups, loadBook } from '../essential/vocab.ts'

/** slug các sách đã thêm vào bộ thẻ (anki_guid dạng ee:<slug>:…) */
function importedSlugs() {
  return new Set(
    db
      .selectDistinct({
        slug: sql<string>`substr(${cards.ankiGuid}, 4, instr(substr(${cards.ankiGuid}, 4), ':') - 1)`,
      })
      .from(cards)
      .where(like(cards.ankiGuid, 'ee:%'))
      .all()
      .map((r) => r.slug),
  )
}

const guidsLike = (pattern: string) =>
  new Set(
    db
      .select({ guid: cards.ankiGuid })
      .from(cards)
      .where(like(cards.ankiGuid, pattern))
      .all()
      .map((r) => r.guid),
  )

const guidsOf = (slug: string) => guidsLike(`ee:${slug}:%`)
/** thẻ ghi chú (Common mistakes / Language help) dùng guid riêng để không lẫn với thẻ từ */
const noteGuidsOf = (slug: string) => guidsLike(`eenote:${slug}:%`)

export const listEssentialBooks = createServerFn({ method: 'GET' }).handler(async () => {
  const imported = importedSlugs()
  return VOCAB_BOOKS.map((b) => ({
    slug: b.slug,
    title: b.title,
    series: b.series,
    added: imported.has(b.slug),
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
      notes: u.notes.length,
      imported: u.words.filter((w) => have.has(w.guid)).length,
      preview: u.words.slice(0, 5).map((w) => w.word),
    }))
  })

export type EssentialUnitRow = Awaited<ReturnType<typeof getEssentialBook>>[number]

/** thêm các unit đã chọn, mỗi unit (unit dài thì mỗi nhóm) một bộ thẻ, gộp theo sách; từ đã có thì bỏ qua */
export const importEssentialBook = createServerFn({ method: 'POST' })
  .validator(z.object({ slug: z.string(), units: z.array(z.number().int().min(0)).min(1) }))
  .handler(async ({ data }) => {
    const book = findBook(data.slug)
    if (!book) throw new Error('Không có sách từ vựng này')
    const want = new Set(data.units)
    const units = (await loadBook(data.slug)).filter((u) => want.has(u.index))
    // bộ cả sách của bản trước còn giữ thẻ → tách trước, để không thêm trùng từ
    await splitBookDecks()
    const have = guidsOf(data.slug)
    const haveNotes = noteGuidsOf(data.slug)

    const max = getConfig().wordsPerGroup
    let deckId: number | null = null
    let added = 0
    let skipped = 0
    let notes = 0
    // thẻ mới học theo thứ tự id → chèn theo thứ tự unit, nhóm trong sách
    db.transaction((tx) => {
      for (const g of units.flatMap((u) => unitGroups(u, max))) {
        const u = g.unit
        const fresh = g.words.filter((w) => !have.has(w.guid))
        skipped += g.words.length - fresh.length
        // ghi chú của unit nằm ở bộ đầu tiên của unit
        const freshNotes = g.part === 0 ? u.notes.filter((n) => !haveNotes.has(n.guid)) : []
        if (!fresh.length && !freshNotes.length) continue
        const unitDeckId = groupDeck(book, g)
        deckId ??= unitDeckId
        for (const n of freshNotes) {
          const row = tx
            .insert(cards)
            .values({
              deckId: unitDeckId,
              front: n.title,
              back: n.lines.join('\n'),
              extra: u.title,
              ankiGuid: n.guid,
            })
            .onConflictDoNothing()
            .returning({ id: cards.id })
            .get() as { id: number } | undefined
          if (row) notes++
        }
        for (const w of fresh) {
          const row = tx
            .insert(cards)
            .values({
              deckId: unitDeckId,
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
    return { deckId, added, skipped, notes }
  })

/**
 * Bổ sung nghĩa tiếng Việt, IPA, từ loại, ví dụ, cụm từ, họ từ, ảnh cho thẻ sách từ vựng lúc học
 * (sách gốc chỉ có tiếng Anh, English Vocabulary in Use không có IPA, ví dụ, ảnh riêng). Tra một lần rồi lưu vào thẻ.
 */
export const enrichCard = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(({ data }) => enrichCardById(data.id))
