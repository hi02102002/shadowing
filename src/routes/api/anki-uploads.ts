import { createFileRoute } from '@tanstack/react-router'

import { saveUpload } from '#/server/media-store'

const MAX_APKG_BYTES = 500 * 1024 ** 2

/** Nhận gói Anki (.apkg) dạng raw body giống /api/uploads, trả uploadId để inspect/import */
export const Route = createFileRoute('/api/anki-uploads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const filename = decodeURIComponent(request.headers.get('x-filename') ?? '')
        if (!/\.apkg$/i.test(filename)) {
          return Response.json({ error: 'Chỉ nhận file gói Anki (.apkg)' }, { status: 415 })
        }
        if (Number(request.headers.get('content-length') ?? 0) > MAX_APKG_BYTES) {
          return Response.json({ error: 'File quá lớn (tối đa 500MB)' }, { status: 413 })
        }
        if (!request.body) return Response.json({ error: 'Thiếu nội dung file' }, { status: 400 })
        try {
          return Response.json(await saveUpload(request.body, filename))
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
        }
      },
    },
  },
})
