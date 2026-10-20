import { createFileRoute } from '@tanstack/react-router'

import { saveUpload } from '#/server/media-store'

/**
 * Nhận file audio/video dạng raw body (không multipart) và ghi thẳng ra đĩa theo luồng,
 * để file vài GB không phải nằm hết trong RAM như FormData của server function.
 * Tên file gửi qua header `x-filename` (encodeURIComponent).
 */
export const Route = createFileRoute('/api/uploads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const type = request.headers.get('content-type') ?? ''
        // một số định dạng (mkv, opus…) trình duyệt không biết MIME → để ffmpeg kiểm tra khi import
        if (type && !/^(audio|video)\//.test(type) && type !== 'application/octet-stream') {
          return Response.json({ error: 'Chỉ nhận file audio hoặc video' }, { status: 415 })
        }
        if (!request.body) return Response.json({ error: 'Thiếu nội dung file' }, { status: 400 })
        const filename = decodeURIComponent(request.headers.get('x-filename') ?? '')
        try {
          return Response.json(await saveUpload(request.body, filename))
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
        }
      },
    },
  },
})
