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
