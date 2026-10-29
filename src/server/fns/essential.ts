import { createServerFn } from '@tanstack/react-start'
import { eq, like, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { cards, decks } from '#/db/schema.ts'
import type { CardInfo } from '#/db/schema.ts'
import { getConfig } from '../config.ts'
import { VOCAB_BOOKS, findBook } from '../essential/books.ts'
import { loadBook } from '../essential/vocab.ts'
import { contextLookup, dictionaryLookup } from '../lookup.ts'

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

const POS_VI: [RegExp, string][] = [
  [/^adj\b/, 'tính từ'],
  [/^adv\b/, 'phó từ'],
  [/^n\b/, 'danh từ'],
  [/^v\b/, 'động từ'],
]

const isIdiom = (kind: string, word: string) =>
  /\b(?:somebody|something|someone|sb|sth)\b/i.test(kind) || kind.toLowerCase().includes(word.toLowerCase())

/** bỏ ghi chú cách dùng kiểu "(relative to something)" khỏi nghĩa */
const stripUsage = (mean: string) =>
  mean.replace(/\([^)]*\b(?:something|somebody|someone|sth|sb)\b[^)]*\)\s*/gi, '').trim()

/**
 * Bổ sung nghĩa tiếng Việt, IPA, từ loại, ví dụ, cụm từ, họ từ, ảnh cho thẻ sách từ vựng lúc học
 * (sách gốc chỉ có tiếng Anh, English Vocabulary in Use không có IPA, ví dụ, ảnh riêng). Tra một lần rồi lưu vào thẻ.
 */
export const enrichCard = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const card = db.select().from(cards).where(eq(cards.id, data.id)).get()
    if (!card) throw new Error('Không tìm thấy thẻ')
    if (card.info != null || !card.ankiGuid?.startsWith('ee:')) return card

    // không có câu ví dụ thì đưa chủ đề unit (mặt sau) làm ngữ cảnh cho AI
    const context = card.example?.split('\n')[0] || card.back
    const [ai, dict] = await Promise.all([
      contextLookup(card.front, context).catch(() => null),
      dictionaryLookup(card.front).catch(() => null),
    ])
    // lỗi mạng → để null, lần học sau tra lại
    if (!ai && !dict) return card

    const headword = dict?.word ?? card.front
    const common = dict?.senses.filter((s) => !s.specialized) ?? []
    // từ loại trong sách (extra = "adj. · Unit 1") → đưa nghĩa đúng từ loại lên đầu
    const bookPos = POS_VI.find(([re]) => re.test(card.extra ?? ''))?.[1]
    const senses = common
      .filter((s) => !isIdiom(s.kind, headword))
      .sort((a, b) => Number(!!bookPos && b.kind.includes(bookPos)) - Number(!!bookPos && a.kind.includes(bookPos)))
    const dictMeaning = senses
      .slice(0, 2)
      .map(
        (s) =>
          (s.kind ? `(${s.kind}) ` : '') + s.means.map(stripUsage).filter(Boolean).slice(0, 2).join('; '),
      )
      .join('\n')

    const uk = getConfig().accent === 'uk'
    const ipa = card.ipa || (uk ? ai?.ipa || dict?.ipaUk : ai?.ipaUs || dict?.ipaUs) || ai?.ipa || dict?.ipaUk || null
    const bookExample = card.example?.split('\n')[0]
    const info: CardInfo = {
      pos: bookPos ?? (ai?.partOfSpeech || senses[0]?.kind || null),
      // ví dụ từ điển (có sẵn bản dịch) trước, rồi tới ví dụ AI đặt
      examples: [...senses.flatMap((s) => s.examples ?? []), ...(ai?.examples ?? [])]
        .filter((e) => e.en !== bookExample)
        .slice(0, 3),
      collocations: dict?.collocations?.slice(0, 8) ?? [],
      idioms: common
        .filter((s) => isIdiom(s.kind, headword))
        .slice(0, 5)
        .map((s) => ({ en: s.kind, vi: s.means.slice(0, 2).join('; ') })),
      family: dict?.family ?? [],
      synonyms: dict?.synonyms ?? [],
    }

    // English Vocabulary in Use: ảnh của mục bài đọc chứa từ (thẻ import trước khi có ảnh này)
    let imageUrl = card.imageUrl
    if (!imageUrl) {
      const units = await loadBook(card.ankiGuid.split(':')[1]).catch(() => [])
      imageUrl = units.flatMap((u) => u.words).find((w) => w.guid === card.ankiGuid)?.imageUrl ?? null
    }

    return db
      .update(cards)
      .set({ meaningVi: card.meaningVi ?? (ai?.meaningInContext || dictMeaning || null), ipa, info, imageUrl })
      .where(eq(cards.id, card.id))
      .returning()
      .get()
  })
