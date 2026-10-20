/** Tạo phụ đề ngay trên máy bằng whisper.cpp (whisper-cli đóng gói kèm app + model tải lần đầu) */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const LOCAL_MODEL = {
  name: 'small.en',
  file: 'ggml-small.en-q8_0.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q8_0.bin',
  bytes: 264_477_561,
  sha256: '67a179f608ea6114bd3fdb9060e762b588a3fb3bd00c4387971be4d177958067',
}

const exe = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'

/** WHISPER_CPP_PATH (app desktop, Docker) hoặc bin/whisper-cli khi chạy dev */
export function whisperBinary(): string | null {
  const fromEnv = process.env.WHISPER_CPP_PATH
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null
  const local = path.resolve('bin', exe)
  return existsSync(local) ? local : null
}

const modelPath = () => path.resolve(process.env.DATA_DIR ?? 'data', 'models', LOCAL_MODEL.file)

let download: { promise: Promise<void>; received: number } | null = null
let downloadError: string | null = null

export type ModelState = 'missing' | 'downloading' | 'ready'

export function whisperLocalStatus() {
  const model: ModelState = download ? 'downloading' : existsSync(modelPath()) ? 'ready' : 'missing'
  return {
    binary: whisperBinary() !== null,
    model,
    modelName: LOCAL_MODEL.name,
    modelBytes: LOCAL_MODEL.bytes,
    /** 0–1 khi đang tải */
    progress: download ? download.received / LOCAL_MODEL.bytes : model === 'ready' ? 1 : 0,
    error: downloadError,
  }
}

/** Tải model (chỉ một lượt tải dù gọi nhiều lần), kiểm tra SHA-256 rồi mới đổi tên thành file thật */
export function ensureModel(): Promise<void> {
  if (existsSync(modelPath())) return Promise.resolve()
  if (download) return download.promise

  const state = { received: 0, promise: Promise.resolve() }
  state.promise = (async () => {
    const dest = modelPath()
    const tmp = `${dest}.download`
    await fs.mkdir(path.dirname(dest), { recursive: true })
    try {
      const res = await fetch(LOCAL_MODEL.url)
      if (!res.ok || !res.body) throw new Error(`Không tải được model Whisper (HTTP ${res.status})`)
      const hash = createHash('sha256')
      const meter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          hash.update(chunk)
          state.received += chunk.length
          cb(null, chunk)
        },
      })
      await pipeline(Readable.fromWeb(res.body as any), meter, createWriteStream(tmp))
      if (hash.digest('hex') !== LOCAL_MODEL.sha256) throw new Error('Model Whisper tải về bị lỗi, hãy thử lại')
      await fs.rename(tmp, dest)
      downloadError = null
    } catch (err) {
      await fs.rm(tmp, { force: true })
      downloadError = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      download = null
    }
  })()
  download = state
  return state.promise
}

export interface WhisperCppJson {
  transcription?: Array<{ offsets: { from: number; to: number }; text: string }>
}

/**
 * Chạy whisper-cli trên file WAV 16kHz.
 * `-ml 1 -sow`: mỗi segment trong JSON là đúng một từ (kèm dấu câu) có timestamp riêng.
 */
export async function transcribeLocal(
  wavPath: string,
  opts: {
    signal?: AbortSignal
    onProgress?: (fraction: number) => void
    /** tiến độ tải model lần đầu (0–1) */
    onModelProgress?: (fraction: number) => void
    onStart?: () => void
  } = {},
): Promise<WhisperCppJson> {
  const bin = whisperBinary()
  if (!bin) throw new Error('Không tìm thấy whisper-cli. Cài whisper.cpp hoặc đặt WHISPER_CPP_PATH.')
  if (!existsSync(modelPath())) {
    const timer = setInterval(() => opts.onModelProgress?.(whisperLocalStatus().progress), 500)
    try {
      opts.onModelProgress?.(0)
      await ensureModel()
    } finally {
      clearInterval(timer)
    }
  }
  opts.signal?.throwIfAborted()
  opts.onStart?.()

  const outBase = wavPath.replace(/\.wav$/i, '')
  // whisper.cpp không tăng tốc thêm sau ~8 luồng, chừa 1 nhân cho app
  const threads = Math.max(1, Math.min(8, os.availableParallelism() - 1))
  const args = ['-m', modelPath(), '-f', wavPath, '-l', 'en', '-t', String(threads)]
  args.push('-ml', '1', '-sow', '-oj', '-of', outBase, '-pp', '-np')

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], signal: opts.signal, windowsHide: true })
    let tail = ''
    proc.stderr.on('data', (d: Buffer) => {
      const text = d.toString()
      tail = (tail + text).slice(-2000)
      for (const m of text.matchAll(/progress\s*=\s*(\d+)%/g)) opts.onProgress?.(Number(m[1]) / 100)
    })
    proc.on('error', (e: NodeJS.ErrnoException) => reject(e.name === 'AbortError' ? e : new Error(`whisper-cli lỗi: ${e.message}`)))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`whisper-cli lỗi (mã ${code}): ${tail.trim().split('\n').slice(-1)[0] ?? ''}`))
    })
  })

  const jsonPath = `${outBase}.json`
  try {
    return JSON.parse(await fs.readFile(jsonPath, 'utf8')) as WhisperCppJson
  } finally {
    await fs.rm(jsonPath, { force: true })
  }
}
