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
