const ID_RE = /^[A-Za-z0-9_-]{11}$/

/**
 * Lấy videoId từ mọi dạng link YouTube phổ biến:
 * watch?v=, youtu.be/, shorts/, embed/, live/, m.youtube.com, music.youtube.com, hoặc id trần.
 */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim()
  if (ID_RE.test(raw)) return raw

  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^(www|m|music)\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1]
    return id && ID_RE.test(id) ? id : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v')
    if (v && ID_RE.test(v)) return v
    const [, kind, id] = url.pathname.split('/')
    if (['shorts', 'embed', 'live', 'v'].includes(kind) && id && ID_RE.test(id)) return id
  }
  return null
}

export function youtubeThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}
