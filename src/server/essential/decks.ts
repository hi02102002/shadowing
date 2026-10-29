/** Bộ thẻ cho sách từ vựng: mỗi unit (unit dài thì mỗi nhóm 20-30 từ) một bộ, gộp theo sách ở danh sách bộ thẻ */
import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { cards, decks } from '#/db/schema.ts'
import { getConfig } from '../config.ts'
import { findBook } from './books.ts'
import type { VocabBook } from './books.ts'
import { loadBook, unitGroups } from './vocab.ts'
import type { UnitGroup } from './vocab.ts'

export const ESSENTIAL_SOURCE = 'essential'

/** bộ thẻ của một nhóm từ trong unit, tạo nếu chưa có (tìm theo ref nên vẫn đúng khi người dùng đổi tên bộ) */
export function groupDeck(book: VocabBook, g: UnitGroup) {
  const ref = `ee:${book.slug}:${g.unit.index}:${g.part}`
  const name = g.parts > 1 ? `${g.unit.title} · ${g.part + 1}/${g.parts}` : g.unit.title
  return (
    db.select({ id: decks.id }).from(decks).where(eq(decks.ref, ref)).get()?.id ??
    db
      .insert(decks)
      .values({ name, source: ESSENTIAL_SOURCE, book: book.title, ref })
      .returning({ id: decks.id })
      .get().id
  )
}

/**
 * Bản trước gom cả sách vào một bộ (1000+ thẻ) → chuyển thẻ sang bộ theo unit/nhóm, giữ nguyên lịch ôn.
 * Chạy khi mở danh sách bộ thẻ; chưa tải được sách (offline) thì để lần sau.
 */
export async function splitBookDecks() {
  const legacy = db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.source, ESSENTIAL_SOURCE), isNull(decks.ref)))
    .all()
  for (const { id } of legacy) {
    const rows = db.select({ id: cards.id, guid: cards.ankiGuid }).from(cards).where(eq(cards.deckId, id)).all()
    const slug = rows.find((r) => r.guid?.startsWith('ee:'))?.guid?.split(':')[1]
    const book = slug ? findBook(slug) : undefined
    if (!book) {
      if (!rows.length) db.delete(decks).where(eq(decks.id, id)).run()
      continue
    }
    const units = await loadBook(book.slug).catch(() => null)
    if (!units) continue
    const max = getConfig().wordsPerGroup
    const groupOf = new Map(
      units.flatMap((u) => unitGroups(u, max).flatMap((g) => g.words.map((w) => [w.guid, g] as const))),
    )
    db.transaction(() => {
      for (const r of rows) {
        const g = r.guid ? groupOf.get(r.guid) : undefined
        if (g) db.update(cards).set({ deckId: groupDeck(book, g) }).where(eq(cards.id, r.id)).run()
      }
      // thẻ người dùng tự thêm vào bộ sách (không thuộc unit nào) → giữ bộ cũ cho chúng
      const left = db.select({ n: sql<number>`count(*)` }).from(cards).where(eq(cards.deckId, id)).get()?.n ?? 0
      if (!left) db.delete(decks).where(eq(decks.id, id)).run()
    })
  }
}
