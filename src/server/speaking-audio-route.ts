/** GET /api/speaking-audio/:id — bản ghi bài nói theo đề (trang /speaking), để người học nghe lại */
import fs from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { defineHandler } from 'nitro/h3'

import { db } from '#/db/index.ts'
import { speakingAttempts } from '#/db/schema.ts'

const MIME: Record<string, string> = { webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4' }

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const row = Number.isInteger(id)
    ? db.select({ audioPath: speakingAttempts.audioPath }).from(speakingAttempts).where(eq(speakingAttempts.id, id)).get()
    : undefined
  const data = row?.audioPath ? await fs.readFile(row.audioPath).catch(() => null) : null
  if (!row?.audioPath || !data) return new Response('Not found', { status: 404 })
  return new Response(data, {
    headers: {
      'content-type': MIME[row.audioPath.split('.').pop() ?? ''] ?? 'application/octet-stream',
      'cache-control': 'private, max-age=86400',
    },
  })
})
