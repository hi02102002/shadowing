/** GET /api/card-media/:file — audio của thẻ từ vựng (import từ Anki), file nhỏ nên trả nguyên file */
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineHandler } from 'nitro/h3'

import { MIME } from './media-route.ts'
import { cardMediaDir } from './media-store.ts'

export default defineHandler(async (event) => {
  const name = path.basename(decodeURIComponent(event.context.params?.file ?? ''))
  const data = name ? await fs.readFile(path.join(cardMediaDir(), name)).catch(() => null) : null
  if (!data) return new Response('Not found', { status: 404 })
  return new Response(data, {
    headers: {
      'content-type': MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'private, max-age=86400',
    },
  })
})
