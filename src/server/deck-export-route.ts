/** Xuất bộ thẻ ra gói Anki (.apkg). Bộ thuộc sách xuất thành "Sách::Unit"; xuất cả sách thì deck cha chứa các unit. */
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull, like } from 'drizzle-orm'
import { defineHandler, getQuery } from 'nitro/h3'

import { db } from '#/db/index.ts'
import { cards, decks } from '#/db/schema.ts'
import { buildApkg } from './anki/export.ts'
import { enrichCardById } from './essential/enrich.ts'

// Anki dùng "::" làm dấu phân cấp
const clean = (s: string) => s.replace(/::/g, ':').trim()

const exportDeck = (deck: typeof decks.$inferSelect) => ({
  name: deck.book
    ? `${clean(deck.book)}::${clean(deck.name)}`
    : clean(deck.name),
  cards: db
    .select()
    .from(cards)
    .where(eq(cards.deckId, deck.id))
    .orderBy(asc(cards.id))
    .all()
    .map((c) => ({
      front: c.front,
      back: c.back,
      ipa: c.ipa,
      example: c.example,
      extra: c.extra,
      meaningVi: c.meaningVi,
      info: c.info,
      imageUrl: c.imageUrl,
      audioUrl: c.audioUrl,
      audioFile: c.audioFile,
      guid: c.ankiGuid,
    })),
})

interface Job {
  title: string
  status: 'processing' | 'completed' | 'error'
  total: number
  processed: number
  createdAt: number
  data?: Uint8Array
  error?: string
}

// ảnh/audio của cả deck mất cả phút → chạy nền, client hỏi tiến độ rồi tải file
const jobs = new Map<string, Job>()
const JOB_TTL_MS = 15 * 60 * 1000

/**
 * GET /api/deck-export/:id?start=1 — bắt đầu xuất (id = số của bộ thẻ, hoặc "book" kèm ?name=<tên sách>), trả {jobId, total}
 * GET /api/deck-export/:id?jobId=… — tiến độ; thêm &download=1 để tải file .apkg
 */
export default defineHandler(async (event) => {
  const query = getQuery(event)
  const jobId = typeof query.jobId === 'string' ? query.jobId : ''
  if (jobId) {
    const job = jobs.get(jobId)
    if (!job)
      return Response.json(
        { error: 'Không thấy tác vụ xuất (hết hạn?)' },
        { status: 404 },
      )
    if (query.download === '1') {
      if (job.status !== 'completed' || !job.data)
        return Response.json({ error: 'File chưa sẵn sàng' }, { status: 400 })
      const filename = `${job.title.replace(/[^\p{L}\p{N}\s.-]/gu, '').trim() || 'deck'}.apkg`
      return new Response(job.data as BodyInit, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': `attachment; filename="deck.apkg"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'cache-control': 'no-store',
        },
      })
    }
    return Response.json({
      status: job.status,
      processed: job.processed,
      total: job.total,
      error: job.error,
    })
  }

  // việc nặng (AI, tải media) chỉ bắt đầu khi client chủ động yêu cầu, tránh prefetch / tải lại trang kích hoạt
  if (query.start !== '1')
    return Response.json({ error: 'Thiếu start=1' }, { status: 400 })
  const param = event.context.params?.id ?? ''
  let list: Array<typeof decks.$inferSelect>
  let title: string
  if (param === 'book') {
    const name = String(query.name ?? '')
    list = name
      ? db
          .select()
          .from(decks)
          .where(eq(decks.book, name))
          .orderBy(asc(decks.id))
          .all()
      : []
    title = name
  } else {
    const deck = /^\d+$/.test(param)
      ? db
          .select()
          .from(decks)
          .where(eq(decks.id, Number(param)))
          .get()
      : undefined
    list = deck ? [deck] : []
    title = deck?.name ?? ''
  }
  if (!list.length) return new Response('Not found', { status: 404 })

  const deckIds = list.map((d) => d.id)
  // thẻ sách chưa tra nghĩa Việt / IPA / ví dụ / chunks (chưa từng học) → tra bằng AI + từ điển như khi học, lưu luôn vào thẻ
  const pending = db
    .select({ id: cards.id })
    .from(cards)
    .where(
      and(
        inArray(cards.deckId, deckIds),
        isNull(cards.info),
        like(cards.ankiGuid, 'ee:%'),
      ),
    )
    .all()
    .map((c) => c.id)
  const cardCount = db
    .select({ id: cards.id })
    .from(cards)
    .where(inArray(cards.deckId, deckIds))
    .all().length
  const total = pending.length + cardCount
  const now = Date.now()
  for (const [jid, j] of jobs)
    if (now - j.createdAt > JOB_TTL_MS) jobs.delete(jid)
  const id = randomUUID()
  const job: Job = {
    title,
    status: 'processing',
    total,
    processed: 0,
    createdAt: now,
  }
  jobs.set(id, job)
  void (async () => {
    let next = 0
    const worker = async () => {
      while (next < pending.length) {
        // lỗi mạng / AI chưa cấu hình: bỏ qua, thẻ xuất với dữ liệu hiện có
        await enrichCardById(pending[next++]).catch(() => undefined)
        job.processed++
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(4, pending.length) }, worker),
    )
    const data = await buildApkg(
      list.map(exportDeck),
      (done) => (job.processed = pending.length + done),
    )
    job.data = data
    job.processed = total
    job.status = 'completed'
  })().catch((err: unknown) => {
    job.status = 'error'
    job.error = err instanceof Error ? err.message : 'Xuất file Anki thất bại'
  })
  return Response.json({ jobId: id, total })
})
