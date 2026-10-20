import { parseYouTubeId } from './youtube-id.ts'

/**
 * Video không phải YouTube được lưu với khoá `vimeo-<id>` trong cột youtube_id
 * (id YouTube luôn đúng 11 ký tự nên không trùng).
 */
const VIMEO_PREFIX = 'vimeo-'

export type VideoSource = { kind: 'youtube'; id: string } | { kind: 'elllo'; url: string }

/** Bài nghe elllo.org, vd. https://elllo.org/video/A1BEG/A1-050-JULIE-WHO-IS-YOUR-FRIEND.html */
export function parseEllloUrl(input: string): string | null {
  const raw = input.trim()
  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (url.hostname.replace(/^www\./, '') !== 'elllo.org') return null
  if (!/\.html?$/i.test(url.pathname)) return null
  url.protocol = 'https:'
  url.hostname = 'elllo.org'
  url.hash = ''
  url.search = ''
  return url.toString()
}

export function parseVideoSource(input: string): VideoSource | null {
  const id = parseYouTubeId(input)
  if (id) return { kind: 'youtube', id }
  const url = parseEllloUrl(input)
  if (url) return { kind: 'elllo', url }
  return null
}

export const vimeoKey = (id: string) => `${VIMEO_PREFIX}${id}`

export function vimeoIdFromKey(key: string): string | null {
  return key.startsWith(VIMEO_PREFIX) ? key.slice(VIMEO_PREFIX.length) : null
}

/** File người dùng tải lên được lưu với khoá `local-<uuid>`, file nằm trong DATA_DIR/media */
const LOCAL_PREFIX = 'local-'
const LOCAL_KEY_RE = /^local-[\w-]{8,64}$/

export const localKey = (id: string) => `${LOCAL_PREFIX}${id}`

/** Chỉ nhận khoá đúng định dạng: khoá được ghép vào đường dẫn file khi phục vụ media */
export const isLocalKey = (key: string) => LOCAL_KEY_RE.test(key)

export const localMediaUrl = (key: string) => `/api/media/${key}`
export const localThumbUrl = (key: string) => `/api/media/${key}?thumb=1`
