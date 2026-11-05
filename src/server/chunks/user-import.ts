/**
 * Nhập chunk từ tài liệu của người dùng (PDF / văn bản họ đã có, vd. The Book of Chunks).
 * Dữ liệu chỉ nằm trong DB trên máy người dùng, không vào seed hay bản phát hành.
 * Chạy nền: tiến độ lưu vào user_chunk_imports để client hỏi lại định kỳ.
 */
import { eq, sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { userChunkImports, userChunks } from '#/db/schema.ts'
import { normalizeChunk } from '#/lib/chunk-match.ts'
import {
  USER_CHUNK_EXTRACT_SYSTEM,
  UserChunkExtractSchema,
  userChunkExtractPrompt,
} from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'

/** ký tự tối đa mỗi lần gửi AI (ghép nhiều trang ngắn) */
const BATCH_CHARS = 6000
export const MAX_PAGES = 400
/** job "đang chạy" mà quá lâu không cập nhật: server đã khởi động lại giữa chừng */
export const STALE_MS = 10 * 60_000

/** PDF → chữ từng trang; tệp văn bản → chia theo dòng trống thành "trang" */
export async function readDocument(file: File): Promise<string[]> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf') ||
    new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  if (isPdf) {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(bytes)
    const { text } = await extractText(pdf, { mergePages: false })
    return text.map((t) => t.replace(/[ \t]+/g, ' ').trim())
  }
  const text = new TextDecoder().decode(bytes)
  const pages: string[] = []
  let current = ''
  for (const block of text.split(/\n\s*\n/)) {
    if (current.length + block.length > BATCH_CHARS && current) {
      pages.push(current)
      current = ''
    }
    current += `${block.trim()}\n\n`
  }
  if (current.trim()) pages.push(current.trim())
  return pages
}

/** gom trang thành lô ≤ BATCH_CHARS, giữ số trang để AI ghi lại */
export function batchPages(pages: string[]) {
  const batches: Array<{ text: string; lastPage: number }> = []
  let text = ''
  pages.forEach((page, index) => {
    if (!page.trim()) return
    const chunk = `[Trang ${index + 1}]\n${page.slice(0, BATCH_CHARS)}\n\n`
    if (text && text.length + chunk.length > BATCH_CHARS) {
      batches.push({ text, lastPage: index })
      text = ''
    }
    text += chunk
  })
  if (text) batches.push({ text, lastPage: pages.length })
  return batches
}

/** chỉ nhận chunk có thật trong đoạn tài liệu; câu ví dụ cũng phải là nguyên văn */
export function verifyExtracted(
  batchText: string,
  items: Array<{
    text: string
    kind: string
    meaningVi: string
    exampleEn: string | null
    page: number | null
  }>,
) {
  const haystack = ` ${normalizeChunk(batchText)} `
  return items.flatMap((item) => {
    const normalizedText = normalizeChunk(item.text.replace(/\.{3}|…/g, ' '))
    const words = normalizedText.split(' ').filter(Boolean).length
    if (words < 2 || words > 12) return []
    if (!haystack.includes(` ${normalizedText} `)) return []
    const example = item.exampleEn?.trim()
    return [
      {
        text: item.text.trim(),
        normalizedText,
        kind: item.kind,
        meaningVi: item.meaningVi.trim() || null,
        exampleEn:
          example && haystack.includes(` ${normalizeChunk(example)} `)
            ? example
            : null,
        page: item.page,
      },
    ]
  })
}

const touch = (
  id: number,
  set: Partial<typeof userChunkImports.$inferInsert>,
) =>
  db
    .update(userChunkImports)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(userChunkImports.id, id))
    .run()

/** chạy nền, không await từ request */
export async function runUserChunkImport(id: number, pages: string[]) {
  try {
    touch(id, { status: 'running', pages: pages.length, donePages: 0 })
    for (const batch of batchPages(pages)) {
      const { chunks } = await structured({
        feature: 'user-import',
        system: USER_CHUNK_EXTRACT_SYSTEM,
        prompt: userChunkExtractPrompt(batch.text),
        schema: UserChunkExtractSchema,
      })
      const rows = verifyExtracted(batch.text, chunks)
      if (rows.length)
        db.insert(userChunks)
          .values(rows.map((row) => ({ ...row, importId: id })))
          .onConflictDoNothing()
          .run()
      touch(id, { donePages: batch.lastPage })
    }
    touch(id, { status: 'done', donePages: pages.length })
  } catch (err) {
    console.error('[user-chunks]', err)
    touch(id, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export const countUserChunks = (id: number) =>
  db
    .select({ n: sql<number>`count(*)` })
    .from(userChunks)
    .where(eq(userChunks.importId, id))
    .get()?.n ?? 0
