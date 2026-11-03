import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { Readable } from 'node:stream'

/** Phục vụ một file với HTTP Range, dùng chung cho video và audio đã cache. */
export async function fileRangeResponse(
  request: Request,
  file: string,
  contentType: string,
  cacheControl = 'private, max-age=3600',
) {
  const stat = await fs.stat(file).catch(() => null)
  if (!stat?.isFile()) return new Response('Not found', { status: 404 })
  const headers: Record<string, string> = {
    'content-type': contentType,
    'accept-ranges': 'bytes',
    'cache-control': cacheControl,
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '')
  if (!range) {
    headers['content-length'] = String(stat.size)
    return new Response(
      Readable.toWeb(createReadStream(file)) as ReadableStream,
      { headers },
    )
  }
  const size = stat.size
  const start = range[1]
    ? Number(range[1])
    : Math.max(0, size - Number(range[2] || size))
  const end = Math.min(
    range[1] && range[2] ? Number(range[2]) : size - 1,
    size - 1,
  )
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return new Response(null, {
      status: 416,
      headers: { 'content-range': `bytes */${size}` },
    })
  }
  headers['content-range'] = `bytes ${start}-${end}/${size}`
  headers['content-length'] = String(end - start + 1)
  return new Response(
    Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream,
    { status: 206, headers },
  )
}
