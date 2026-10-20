/** Nơi lưu file media người dùng tải lên: DATA_DIR/uploads (tạm, chờ import) và DATA_DIR/media (đã import) */
import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const MAX_UPLOAD_BYTES = 4 * 1024 ** 3
/** upload không được import (đóng tab, bấm huỷ…) sẽ bị xoá sau chừng này */
const STALE_UPLOAD_MS = 24 * 3600_000

const dataDir = () => path.resolve(process.env.DATA_DIR ?? 'data')
export const mediaDir = () => path.join(dataDir(), 'media')
const uploadsDir = () => path.join(dataDir(), 'uploads')
export const jobsDir = () => path.join(dataDir(), 'jobs')

const UPLOAD_ID_RE = /^[0-9a-f-]{36}$/

/** đuôi file chỉ để ffmpeg/trình duyệt đoán định dạng, không tin tên file người dùng */
function safeExt(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : ''
}

export async function saveUpload(body: ReadableStream<Uint8Array>, filename: string) {
  await fs.mkdir(uploadsDir(), { recursive: true })
  void cleanStaleUploads()
  const id = randomUUID()
  const file = path.join(uploadsDir(), `${id}${safeExt(filename)}`)
  let size = 0
  const limit = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length
      cb(size > MAX_UPLOAD_BYTES ? new Error('File quá lớn (tối đa 4GB)') : null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(body as any), limit, createWriteStream(file))
  } catch (err) {
    await fs.rm(file, { force: true })
    throw err
  }
  if (size === 0) {
    await fs.rm(file, { force: true })
    throw new Error('File rỗng')
  }
  return { uploadId: id, size }
}

/** Đường dẫn file đã upload theo id, null nếu không có (hết hạn hoặc id sai) */
export async function findUpload(uploadId: string): Promise<string | null> {
  if (!UPLOAD_ID_RE.test(uploadId)) return null
  const name = (await fs.readdir(uploadsDir()).catch(() => [] as string[])).find(
    (f) => f === uploadId || f.startsWith(`${uploadId}.`),
  )
  return name ? path.join(uploadsDir(), name) : null
}

export async function removeUpload(uploadId: string) {
  const file = await findUpload(uploadId)
  if (file) await fs.rm(file, { force: true })
}

async function cleanStaleUploads() {
  const now = Date.now()
  for (const name of await fs.readdir(uploadsDir()).catch(() => [] as string[])) {
    const file = path.join(uploadsDir(), name)
    const stat = await fs.stat(file).catch(() => null)
    if (stat && now - stat.mtimeMs > STALE_UPLOAD_MS) await fs.rm(file, { force: true })
  }
}

/** Chuyển file upload vào thư mục media với tên theo khoá video, trả tên file (lưu ở cột media_path) */
export async function moveUploadToMedia(uploadFile: string, key: string) {
  await fs.mkdir(mediaDir(), { recursive: true })
  const name = `${key}${path.extname(uploadFile)}`
  await fs.rename(uploadFile, path.join(mediaDir(), name))
  return name
}

export const thumbPath = (key: string) => path.join(mediaDir(), `${key}.thumb.jpg`)

export async function removeMedia(key: string, mediaPath: string | null) {
  if (mediaPath) await fs.rm(path.join(mediaDir(), path.basename(mediaPath)), { force: true })
  await fs.rm(thumbPath(key), { force: true })
}
