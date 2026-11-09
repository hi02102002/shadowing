import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'

const dir = mkdtempSync(path.join(tmpdir(), 'shadowing-segment-edit-'))
process.env.DATABASE_URL = path.join(dir, 'test.db')

const { db } = await import('#/db/index.ts')
const { videos, segments, dictationAttempts, pronunciationAttempts } =
  await import('#/db/schema.ts')
const { applySegmentEdit } = await import('./segment-edits.ts')

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const words = (a: string, b: string, start: number) =>
  JSON.stringify([
    { w: a, s: start, e: start + 400 },
    { w: b, s: start + 400, e: start + 900 },
  ])

describe('persistent segment edits', () => {
  it('giữ mọi điểm và lịch sử khi ghép, tách, hoàn tác và khôi phục', async () => {
    const video = db
      .insert(videos)
      .values({
        youtubeId: 'local:edit-test',
        title: 'Test',
        captionSource: 'file',
      })
      .returning()
      .get()
    const original = db
      .insert(segments)
      .values([
        {
          videoId: video.id,
          idx: 0,
          startMs: 1000,
          endMs: 1900,
          text: 'One two',
          wordsJson: words('One', 'two', 1000),
        },
        {
          videoId: video.id,
          idx: 1,
          startMs: 2000,
          endMs: 2900,
          text: 'Three four',
          wordsJson: words('Three', 'four', 2000),
        },
        {
          videoId: video.id,
          idx: 2,
          startMs: 3000,
          endMs: 3900,
          text: 'Five six',
          wordsJson: words('Five', 'six', 3000),
        },
      ])
      .returning()
      .all()
    const [a, b, c] = original
    for (const row of original) {
      db.insert(dictationAttempts)
        .values({
          segmentId: row.id,
          input: row.text,
          score: 100,
          diffJson: '[]',
        })
        .run()
      db.insert(pronunciationAttempts)
        .values({
          segmentId: row.id,
          mode: 'repeat',
          transcript: row.text,
          accuracy: 100,
          completeness: 100,
          wordsJson: '[]',
        })
        .run()
    }
    const rows = () =>
      db
        .select()
        .from(segments)
        .where(and(eq(segments.videoId, video.id), eq(segments.archived, false)))
        .orderBy(asc(segments.idx))
        .all()
    const scores = () =>
      db
        .select()
        .from(dictationAttempts)
        .all()
        .map((row) => row.segmentId)

    await applySegmentEdit({
      youtubeId: video.youtubeId,
      expectedRevision: 0,
      action: { type: 'merge', ids: [a.id, b.id] },
    })
    expect(rows().map((row) => row.text)).toEqual([
      'One two Three four',
      'Five six',
    ])
    expect(scores()).toEqual([a.id, b.id, c.id])
    expect(db.select().from(pronunciationAttempts).all().map((row) => row.segmentId)).toEqual([a.id, b.id, c.id])
    const mergedId = rows()[0].id
    expect(mergedId).not.toBe(a.id)
    expect(rows()[0].archived).toBe(false)
    await expect(
      applySegmentEdit({
        youtubeId: video.youtubeId,
        expectedRevision: 0,
        action: { type: 'undo' },
      }),
    ).rejects.toThrow('Tải lại')
    await applySegmentEdit({
      youtubeId: video.youtubeId,
      expectedRevision: 1,
      action: { type: 'split', id: mergedId, wordIndex: 2 },
    })
    expect(rows().map((row) => row.text)).toEqual([
      'One two',
      'Three four',
      'Five six',
    ])
    await applySegmentEdit({
      youtubeId: video.youtubeId,
      expectedRevision: 2,
      action: { type: 'undo' },
    })
    expect(rows()).toHaveLength(2)
    await applySegmentEdit({
      youtubeId: video.youtubeId,
      expectedRevision: 1,
      action: { type: 'reset' },
    })
    expect(rows().map((row) => row.text)).toEqual(
      original.map((row) => row.text),
    )
    expect(rows().map((row) => row.id)).toEqual(original.map((row) => row.id))
    expect(scores()).toEqual([a.id, b.id, c.id])
    expect(db.select().from(pronunciationAttempts).all().map((row) => row.segmentId)).toEqual([a.id, b.id, c.id])
    await expect(applySegmentEdit({
      youtubeId: video.youtubeId,
      expectedRevision: 0,
      action: { type: 'merge', ids: [a.id, c.id] },
    })).rejects.toThrow('liền nhau')
    expect(rows().map((row) => row.id)).toEqual(original.map((row) => row.id))
  })
})
