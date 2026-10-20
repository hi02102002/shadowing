/** Xử lý file media bằng ffmpeg: đọc thời lượng, tách audio cho Whisper, lấy ảnh thumbnail */
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

const ffmpegBin = () => process.env.FFMPEG_PATH || 'ffmpeg'

/** Chạy ffmpeg, trả stderr. `allowFail`: `ffmpeg -i` không có output luôn thoát mã 1 */
function ffmpeg(args: string[], opts: { signal?: AbortSignal; allowFail?: boolean } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegBin(), ['-hide_banner', '-nostdin', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
      signal: opts.signal,
    })
    const err: Buffer[] = []
    ff.stderr.on('data', (d: Buffer) => err.push(d))
    ff.on('error', (e: NodeJS.ErrnoException) =>
      reject(e.code === 'ENOENT' ? new Error('Không tìm thấy ffmpeg. Cài ffmpeg hoặc đặt FFMPEG_PATH.') : e),
    )
    ff.on('close', (code) => {
      const stderr = Buffer.concat(err).toString()
      if (code === 0 || opts.allowFail) resolve(stderr)
      else reject(new Error(`ffmpeg lỗi: ${stderr.trim().split('\n').slice(-1)[0]?.slice(0, 200) ?? code}`))
    })
  })
}

export interface MediaInfo {
  durationSec: number
  /** có luồng hình (không tính ảnh bìa nhúng trong mp3/m4a) */
  hasVideo: boolean
}

/** ffmpeg-static không kèm ffprobe → đọc thông tin từ stderr của `ffmpeg -i` */
export async function probeMedia(file: string): Promise<MediaInfo> {
  const stderr = await ffmpeg(['-i', file], { allowFail: true })
  return parseProbe(stderr)
}

export function parseProbe(stderr: string): MediaInfo {
  const m = /Duration: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr)
  if (!m) throw new Error('File không phải audio/video hợp lệ')
  const hasAudio = /Stream #.*: Audio:/.test(stderr)
  if (!hasAudio) throw new Error('File không có âm thanh')
  return {
    durationSec: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]),
    hasVideo: stderr.split('\n').some((l) => /Stream #.*: Video:/.test(l) && !l.includes('attached pic')),
  }
}

/** WAV mono 16kHz: định dạng whisper.cpp yêu cầu */
export async function toWav16kFile(input: string, out: string, signal?: AbortSignal) {
  await ffmpeg(['-y', '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', out], { signal })
}

/**
 * Cắt audio thành các đoạn mp3 mono 32kbps (10 phút ≈ 2.4MB) để gửi API STT,
 * vì OpenAI giới hạn 25MB mỗi file.
 */
export async function extractAudioChunks(
  input: string,
  dir: string,
  opts: { chunkSec?: number; signal?: AbortSignal } = {},
): Promise<Array<{ path: string; offsetMs: number }>> {
  const chunkSec = opts.chunkSec ?? 600
  await fs.mkdir(dir, { recursive: true })
  await ffmpeg(
    [
      '-y',
      '-i', input,
      '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '32k',
      '-f', 'segment', '-segment_time', String(chunkSec), '-reset_timestamps', '1',
      path.join(dir, 'chunk-%03d.mp3'),
    ],
    { signal: opts.signal },
  )
  const files = (await fs.readdir(dir)).filter((f) => /^chunk-\d+\.mp3$/.test(f)).sort()
  return files.map((f, i) => ({ path: path.join(dir, f), offsetMs: i * chunkSec * 1000 }))
}

/** Ảnh đại diện lấy ở khoảng 10% thời lượng (tránh màn hình đen đầu video) */
export async function makeThumbnail(input: string, out: string, durationSec: number) {
  const at = Math.min(Math.max(durationSec * 0.1, 0), 30)
  await ffmpeg(['-y', '-ss', at.toFixed(2), '-i', input, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', out])
}
