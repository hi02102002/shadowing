import { and, asc, eq, gt, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { segmentEditRevisions, segmentEditStates, segments, videos } from '#/db/schema.ts'
import { mergeSegments, splitSegment } from '#/lib/segment-edit.ts'

export const EditInput = z.object({
  youtubeId: z.string(),
  expectedRevision: z.number().int().min(0),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('merge'), ids: z.array(z.number().int().positive()).min(2) }),
    z.object({ type: z.literal('split'), id: z.number().int().positive(), wordIndex: z.number().int().positive() }),
    z.object({ type: z.literal('undo') }),
    z.object({ type: z.literal('reset') }),
  ]),
})

export type EditInputType = z.infer<typeof EditInput>

/** Đoạn cũ được lưu nguyên vẹn để bài làm, điểm, ghi âm, từ vựng và Sổ lỗi vẫn trỏ đúng câu. */
export async function applySegmentEdit(data: EditInputType) {
  return db.transaction((tx) => {
    const video = tx.select({ id: videos.id }).from(videos)
      .where(eq(videos.youtubeId, data.youtubeId)).get()
    if (!video) throw new Error('Không tìm thấy video')
    const state = tx.select().from(segmentEditStates)
      .where(eq(segmentEditStates.videoId, video.id)).get()
    const cursor = state?.cursor ?? 0
    if (cursor !== data.expectedRevision)
      throw new Error('Transcript đã được chỉnh ở nơi khác. Tải lại trang rồi thử lại.')
    const current = tx.select().from(segments)
      .where(and(eq(segments.videoId, video.id), eq(segments.archived, false)))
      .orderBy(asc(segments.idx)).all()
    if (!current.length) throw new Error('Video không có đoạn để chỉnh')
    const snapshot = (rows: typeof current) => JSON.stringify(rows.map((row) => row.id))
    let focusIdx = 0

    if (data.action.type === 'merge' || data.action.type === 'split') {
      if (!state) {
        tx.insert(segmentEditStates).values({ videoId: video.id, cursor: 0 }).run()
        tx.insert(segmentEditRevisions).values({ videoId: video.id, revision: 0, snapshotJson: snapshot(current) }).run()
      }
      tx.delete(segmentEditRevisions).where(and(
        eq(segmentEditRevisions.videoId, video.id), gt(segmentEditRevisions.revision, cursor),
      )).run()
      if (data.action.type === 'merge') {
        const ids = data.action.ids
        if (new Set(ids).size !== ids.length) throw new Error('Đoạn chọn bị trùng')
        const positions = ids.map((id) => current.findIndex((row) => row.id === id)).sort((a, b) => a - b)
        if (positions[0] < 0 || positions.some((position, i) => position !== positions[0] + i))
          throw new Error('Chỉ ghép các đoạn liền nhau trong cùng video')
        const merged = mergeSegments(positions.map((position) => current[position]))
        tx.update(segments).set({ archived: true }).where(inArray(segments.id, ids)).run()
        tx.insert(segments).values({ ...merged, videoId: video.id, idx: positions[0] }).run()
        focusIdx = positions[0]
      } else {
        const splitId = data.action.id
        const row = current.find((item) => item.id === splitId)
        if (!row) throw new Error('Không tìm thấy đoạn cần tách')
        const [left, right] = splitSegment(row, data.action.wordIndex)
        tx.update(segments).set({ archived: true }).where(eq(segments.id, row.id)).run()
        tx.insert(segments).values([
          { ...left, videoId: video.id, idx: row.idx },
          { ...right, videoId: video.id, idx: row.idx + 1 },
        ]).run()
        focusIdx = current.indexOf(row)
      }
      const after = tx.select().from(segments)
        .where(and(eq(segments.videoId, video.id), eq(segments.archived, false)))
        .orderBy(asc(segments.startMs), asc(segments.id)).all()
      after.forEach((row, idx) => tx.update(segments).set({ idx }).where(eq(segments.id, row.id)).run())
      tx.insert(segmentEditRevisions).values({ videoId: video.id, revision: cursor + 1, snapshotJson: snapshot(after) }).run()
      tx.update(segmentEditStates).set({ cursor: cursor + 1 }).where(eq(segmentEditStates.videoId, video.id)).run()
      return { revision: cursor + 1, focusIdx }
    }

    if (!state || cursor === 0) throw new Error('Không có thay đổi nào để hoàn tác')
    const targetRevision = data.action.type === 'reset' ? 0 : cursor - 1
    const targetRow = tx.select().from(segmentEditRevisions).where(and(
      eq(segmentEditRevisions.videoId, video.id), eq(segmentEditRevisions.revision, targetRevision),
    )).get()
    if (!targetRow) throw new Error('Không tìm thấy phiên bản transcript')
    const targetIds = JSON.parse(targetRow.snapshotJson) as number[]
    const existing = tx.select({ id: segments.id }).from(segments)
      .where(eq(segments.videoId, video.id)).all()
    const known = new Set(existing.map((row) => row.id))
    if (targetIds.some((id) => !known.has(id))) throw new Error('Thiếu đoạn trong lịch sử')
    const remove = current.filter((row) => !targetIds.includes(row.id)).map((row) => row.id)
    if (remove.length) tx.update(segments).set({ archived: true }).where(inArray(segments.id, remove)).run()
    targetIds.forEach((id, idx) => tx.update(segments).set({ archived: false, idx }).where(eq(segments.id, id)).run())
    if (data.action.type === 'reset') tx.delete(segmentEditRevisions).where(and(
      eq(segmentEditRevisions.videoId, video.id), gt(segmentEditRevisions.revision, 0),
    )).run()
    tx.update(segmentEditStates).set({ cursor: targetRevision }).where(eq(segmentEditStates.videoId, video.id)).run()
    return { revision: targetRevision, focusIdx }
  })
}
