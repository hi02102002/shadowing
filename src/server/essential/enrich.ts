import { eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { cards } from '#/db/schema.ts'
import type { CardInfo } from '#/db/schema.ts'
import { getConfig } from '../config.ts'
import { phraseToIpa } from '../ipa.ts'
import { contextLookup, dictionaryLookup } from '../lookup.ts'
import { tatoebaExamples } from '../tatoeba.ts'
import { loadBook } from './vocab.ts'

const POS_VI: [RegExp, string][] = [
  [/^adj\b/, 'tính từ'],
  [/^adv\b/, 'phó từ'],
  [/^n\b/, 'danh từ'],
  [/^v\b/, 'động từ'],
]

const isIdiom = (kind: string, word: string) =>
  /\b(?:somebody|something|someone|sb|sth)\b/i.test(kind) ||
  kind.toLowerCase().includes(word.toLowerCase())

/** bỏ ghi chú cách dùng kiểu "(relative to something)" khỏi nghĩa */
const stripUsage = (mean: string) =>
  mean
    .replace(/\([^)]*\b(?:something|somebody|someone|sth|sb)\b[^)]*\)\s*/gi, '')
    .trim()

/**
 * Bổ sung nghĩa tiếng Việt, IPA, từ loại, ví dụ, cụm từ, họ từ, ảnh cho thẻ sách từ vựng lúc học
 * (sách gốc chỉ có tiếng Anh, English Vocabulary in Use không có IPA, ví dụ, ảnh riêng). Tra một lần rồi lưu vào thẻ.
 */
export async function enrichCardById(id: number) {
  const card = db.select().from(cards).where(eq(cards.id, id)).get()
  if (!card) throw new Error('Không tìm thấy thẻ')
  if (card.info != null || !card.ankiGuid?.startsWith('ee:')) return card

  // không có câu ví dụ thì đưa chủ đề unit (mặt sau) làm ngữ cảnh cho AI
  const context = card.example?.split('\n')[0] || card.back
  const [ai, dict, tatoeba] = await Promise.all([
    contextLookup(card.front, context).catch(() => null),
    dictionaryLookup(card.front).catch(() => null),
    tatoebaExamples(card.front).catch(() => []),
  ])
  // lỗi mạng → để null, lần học sau tra lại
  if (!ai && !dict) return card

  const headword = dict?.word ?? card.front
  const common = dict?.senses.filter((s) => !s.specialized) ?? []
  // từ loại trong sách (extra = "adj. · Unit 1") → đưa nghĩa đúng từ loại lên đầu
  const bookPos = POS_VI.find(([re]) => re.test(card.extra ?? ''))?.[1]
  const senses = common
    .filter((s) => !isIdiom(s.kind, headword))
    .sort(
      (a, b) =>
        Number(!!bookPos && b.kind.includes(bookPos)) -
        Number(!!bookPos && a.kind.includes(bookPos)),
    )
  const dictMeaning = senses
    .slice(0, 2)
    .map(
      (s) =>
        (s.kind ? `(${s.kind}) ` : '') +
        s.means.map(stripUsage).filter(Boolean).slice(0, 2).join('; '),
    )
    .join('\n')

  const uk = getConfig().accent === 'uk'
  // IPA từ từ điển / CMU trước, AI chỉ khi không có nguồn nào khác
  const ipa =
    card.ipa ||
    (uk ? dict?.ipaUk : dict?.ipaUs) ||
    (await phraseToIpa(card.front, uk ? 'uk' : 'us')) ||
    dict?.ipaUk ||
    dict?.ipaUs ||
    (uk ? ai?.ipa : ai?.ipaUs) ||
    ai?.ipa ||
    null
  const bookExample = card.example?.split('\n')[0]
  const info: CardInfo = {
    pos: bookPos ?? (ai?.partOfSpeech || senses[0]?.kind || null),
    // câu ngắn Tatoeba (người thật viết, có bản dịch) trước, rồi ví dụ từ điển, cuối cùng ví dụ AI đặt
    examples: [
      ...tatoeba,
      ...senses.flatMap((s) => s.examples ?? []),
      ...(ai?.examples ?? []),
    ]
      .filter((e) => e.en !== bookExample)
      .slice(0, 4),
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
    imageUrl =
      units.flatMap((u) => u.words).find((w) => w.guid === card.ankiGuid)
        ?.imageUrl ?? null
  }

  return db
    .update(cards)
    .set({
      meaningVi:
        card.meaningVi ?? (ai?.meaningInContext || dictMeaning || null),
      ipa,
      info,
      imageUrl,
    })
    .where(eq(cards.id, card.id))
    .returning()
    .get()
}
