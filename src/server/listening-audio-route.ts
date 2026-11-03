import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { eq } from 'drizzle-orm'
import { defineHandler } from 'nitro/h3'

import { db } from '#/db/index.ts'
import { listeningPassages } from '#/db/schema.ts'
import { fileRangeResponse } from './file-range.ts'
import { dataDir } from './media-store.ts'

const safeName = (id: number, section: number) => `${id}-${section}.mp3`

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const section = Number(event.context.params?.section)
  if (!Number.isInteger(id) || !Number.isInteger(section) || section < 0)
    return new Response('Not found', { status: 404 })
  const row = db
    .select({ sections: listeningPassages.sections })
    .from(listeningPassages)
    .where(eq(listeningPassages.id, id))
    .get()
  const media = row?.sections[section]?.media
  if (!media || media.kind !== 'audio')
    return new Response('Not found', { status: 404 })

  const dir = path.join(dataDir(), 'listening')
  const file = path.join(dir, safeName(id, section))
  if (!(await fs.stat(file).catch(() => null))) {
    const res = await fetch(media.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok || !res.body)
      return new Response(`Không tải được audio (HTTP ${res.status})`, {
        status: 502,
      })
    await fs.mkdir(dir, { recursive: true })
    const temp = `${file}.part`
    try {
      await pipeline(
        Readable.fromWeb(res.body as never),
        createWriteStream(temp),
      )
      await fs.rename(temp, file)
    } catch (error) {
      await fs.rm(temp, { force: true })
      throw error
    }
  }
  return fileRangeResponse(
    event.req,
    file,
    'audio/mpeg',
    'private, max-age=86400',
  )
})
