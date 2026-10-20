import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import type { Json3 } from '../transcript/json3.ts'

const exec = promisify(execFile)

const YTDLP = process.env.YTDLP_PATH || (existsSync('bin/yt-dlp') ? path.resolve('bin/yt-dlp') : 'yt-dlp')
// app desktop không có `node` trong PATH → trỏ thẳng tới runtime, vd. "node:/path/to/Shadowing"
const JS_RUNTIME = process.env.YTDLP_JS_RUNTIME || 'node'

async function ytdlp(args: string[], timeout = 120_000, signal?: AbortSignal) {
  try {
    const { stdout } = await exec(YTDLP, ['--js-runtimes', JS_RUNTIME, '--no-warnings', ...args], {
      timeout,
      maxBuffer: 64 * 1024 * 1024,
      signal,
    })
    return stdout
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err
    const msg = String(err?.stderr || err?.message || err)
    if (err?.code === 'ENOENT') throw new Error('Không tìm thấy yt-dlp. Cài yt-dlp hoặc đặt YTDLP_PATH.')
    if (/Private video|Video unavailable|This video is not available/i.test(msg)) {
      throw new Error('Video không khả dụng (riêng tư, bị xoá hoặc chặn theo vùng).')
    }
    if (/Sign in to confirm/i.test(msg)) throw new Error('YouTube yêu cầu đăng nhập cho video này (giới hạn độ tuổi).')
    throw new Error(`yt-dlp lỗi: ${msg.split('\n').filter(Boolean).slice(-1)[0] ?? msg}`)
  }
}

interface CaptionTrack {
  ext: string
  url: string
  name?: string
}
export interface VideoInfo {
  id: string
  title: string
  channel?: string
  duration?: number
  thumbnail?: string
  language?: string
  subtitles?: Record<string, CaptionTrack[]>
  automatic_captions?: Record<string, CaptionTrack[]>
}

export function watchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`
}

export async function fetchInfo(id: string): Promise<VideoInfo> {
  return fetchUrlInfo(watchUrl(id))
}

/** `referer`: video Vimeo nhúng chỉ cho phép xem từ trang chứa nó */
export async function fetchUrlInfo(url: string, referer?: string): Promise<VideoInfo> {
  const out = await ytdlp(['--skip-download', '--dump-single-json', ...(referer ? ['--referer', referer] : []), url])
  return JSON.parse(out) as VideoInfo
}

export interface SearchEntry {
  id: string
  title: string
  channel?: string
  duration?: number
  thumbnails?: { url: string }[]
}

/** Tìm video YouTube, chỉ lấy thông tin danh sách (không mở từng video) */
export async function searchVideos(query: string, limit: number): Promise<SearchEntry[]> {
  const out = await ytdlp(['--flat-playlist', '--dump-single-json', `ytsearch${limit}:${query}`])
  return ((JSON.parse(out) as { entries?: SearchEntry[] }).entries ?? []).filter((e) => e.id)
}

/**
 * Tải luồng audio tốt nhất (để tạo phụ đề bằng Whisper khi video không có phụ đề).
 * Không chuyển định dạng ở đây: ffmpeg của app sẽ đọc thẳng file m4a/webm.
 */
export async function downloadAudio(
  url: string,
  dir: string,
  opts: { referer?: string; signal?: AbortSignal } = {},
): Promise<string> {
  await fs.mkdir(dir, { recursive: true })
  await ytdlp(
    [
      '-f', 'bestaudio/best',
      '--no-playlist',
      '-o', path.join(dir, 'source.%(ext)s'),
      ...(opts.referer ? ['--referer', opts.referer] : []),
      url,
    ],
    15 * 60_000,
    opts.signal,
  )
  const name = (await fs.readdir(dir)).find((f) => f.startsWith('source.') && !f.endsWith('.part'))
  if (!name) throw new Error('Không tải được audio của video')
  return path.join(dir, name)
}

/** Các link phụ đề VTT tiếng Anh (Vimeo: `en`, `en-x-autogen`…), phụ đề thủ công trước */
export function vttTrackUrls(info: VideoInfo): { urls: string[]; source: 'manual' | 'auto' } | null {
  const langs = Object.keys(info.subtitles ?? {}).filter((l) => /^en\b/.test(l))
  // en-x-autogen là phụ đề máy của Vimeo
  langs.sort((a, b) => Number(a.includes('autogen')) - Number(b.includes('autogen')))
  const lang = langs[0]
  if (!lang) return null
  const urls = info.subtitles![lang].filter((t) => t.ext === 'vtt').map((t) => t.url)
  return urls.length ? { urls, source: lang.includes('autogen') ? 'auto' : 'manual' } : null
}

/** Tải file VTT đầu tiên tải được (bỏ qua playlist HLS `#EXTM3U`) */
export async function downloadVtt(urls: string[]): Promise<string> {
  for (const url of urls) {
    const res = await fetch(url).catch(() => null)
    if (!res?.ok) continue
    const text = await res.text()
    if (text.trimStart().startsWith('WEBVTT')) return text
  }
  throw new Error('Không tải được phụ đề của video')
}

const isEnglish = (lang: string) => /^en(-[A-Za-z]+)?$/.test(lang)

/**
 * Chọn track phụ đề tiếng Anh tốt nhất:
 * 1. phụ đề thủ công en / en-US / en-GB…
 * 2. auto-caption gốc (`en-orig`, hoặc `en` nếu video gốc là tiếng Anh)
 * Bỏ qua các bản dịch máy (en-xx từ ngôn ngữ khác).
 */
export function pickCaptionTrack(info: VideoInfo): { url: string; source: 'manual' | 'auto' } | null {
  const json3 = (tracks?: CaptionTrack[]) => tracks?.find((t) => t.ext === 'json3')?.url

  const manualLangs = Object.keys(info.subtitles ?? {}).filter((l) => isEnglish(l) || l === 'en-orig')
  manualLangs.sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)))
  for (const lang of manualLangs) {
    const url = json3(info.subtitles![lang])
    if (url) return { url, source: 'manual' }
  }

  const auto = info.automatic_captions ?? {}
  const videoIsEnglish = !info.language || info.language.startsWith('en')
  const autoOrder = ['en-orig', ...(videoIsEnglish ? ['en', 'en-US', 'en-GB'] : [])]
  for (const lang of autoOrder) {
    const url = json3(auto[lang])
    if (url) return { url, source: 'auto' }
  }
  return null
}

export async function downloadCaptions(url: string): Promise<Json3> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } })
    if (res.ok) {
      const text = await res.text()
      if (text.trim()) return JSON.parse(text) as Json3
      lastErr = new Error('Phụ đề rỗng')
    } else {
      lastErr = new Error(`Tải phụ đề lỗi HTTP ${res.status}`)
      if (res.status !== 429 && res.status < 500) break
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
  }
  throw lastErr
}
