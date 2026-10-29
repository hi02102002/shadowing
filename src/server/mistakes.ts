import { sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { mistakes } from '#/db/schema.ts'

interface MistakeInput {
  word: string
  heard: string
  type: string
  ipa: string
  explanation: string
  tip: string
}

/** Ghi lỗi vào sổ lỗi: cùng từ + loại + nguồn thì tăng count và cập nhật giải thích mới nhất */
export function recordMistakes(source: 'dictation' | 'pronunciation', segmentId: number, list: MistakeInput[]) {
  for (const m of list) {
    const word = m.word.trim().toLowerCase()
    if (!word) continue
    db.insert(mistakes)
      .values({
        word,
        heard: m.heard || null,
        type: m.type,
        source,
        segmentId,
        explanation: m.explanation,
        tip: m.tip,
        ipa: m.ipa || null,
      })
      .onConflictDoUpdate({
        target: [mistakes.word, mistakes.type, mistakes.source],
        set: {
          count: sql`${mistakes.count} + 1`,
          heard: m.heard || null,
          segmentId,
          explanation: m.explanation,
          tip: m.tip,
          ipa: m.ipa || null,
          lastSeenAt: sql`(unixepoch())`,
        },
      })
      .run()
  }
}

/** Lỗi bài tập ngữ pháp: word = đáp án đúng, heard = câu người học trả lời, ref trỏ về câu trong sách */
export function recordGrammarMistake(m: { word: string; heard: string; ref: string; explanation: string }) {
  const word = m.word.trim().toLowerCase()
  if (!word) return
  db.insert(mistakes)
    .values({ word, heard: m.heard || null, type: 'grammar', source: 'grammar', grammarRef: m.ref, explanation: m.explanation })
    .onConflictDoUpdate({
      target: [mistakes.word, mistakes.type, mistakes.source],
      set: {
        count: sql`${mistakes.count} + 1`,
        heard: m.heard || null,
        grammarRef: m.ref,
        explanation: m.explanation,
        tip: null,
        lastSeenAt: sql`(unixepoch())`,
      },
    })
    .run()
}

/** Lỗi khi nói tự do (hội thoại, nói theo đề): word = cách nói đúng, heard = câu người học đã nói */
export function recordSpeechMistakes(
  source: 'conversation' | 'speaking',
  list: Array<{ said: string; better: string; type: string; explanation: string }>,
) {
  for (const m of list) {
    const word = m.better.trim().toLowerCase()
    if (!word) continue
    db.insert(mistakes)
      .values({ word, heard: m.said || null, type: m.type, source, explanation: m.explanation })
      .onConflictDoUpdate({
        target: [mistakes.word, mistakes.type, mistakes.source],
        set: {
          count: sql`${mistakes.count} + 1`,
          heard: m.said || null,
          explanation: m.explanation,
          lastSeenAt: sql`(unixepoch())`,
        },
      })
      .run()
  }
}
