/** Tạo phụ đề ngay trên máy bằng whisper.cpp (whisper-cli đóng gói kèm app + model tải lần đầu) */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { getConfig } from './config.ts'
import type { WhisperModel } from './config.ts'

/** file ggml của whisper.cpp; large-v3-turbo nén q5_0: gần bằng large-v3, nhanh hơn nhiều nhờ decoder 4 lớp */
export const LOCAL_MODELS = {
  'large-v3-turbo': {
    file: 'ggml-large-v3-turbo-q5_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
    bytes: 574_041_195,
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
  },
  'small.en': {
    file: 'ggml-small.en-q8_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q8_0.bin',
    bytes: 264_477_561,
    sha256: '67a179f608ea6114bd3fdb9060e762b588a3fb3bd00c4387971be4d177958067',
  },
} satisfies Record<WhisperModel, { file: string; url: string; bytes: number; sha256: string }>

/** model đang chọn trong Cài đặt */
const currentModel = () => {
  const name = getConfig().whisperModel
  return { name, ...LOCAL_MODELS[name] }
}

const exe = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'

/** WHISPER_CPP_PATH (app desktop, Docker) hoặc bin/whisper-cli khi chạy dev */
export function whisperBinary(): string | null {
  const fromEnv = process.env.WHISPER_CPP_PATH
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null
  const local = path.resolve('bin', exe)
  return existsSync(local) ? local : null
}

const modelPath = (file = currentModel().file) => path.resolve(process.env.DATA_DIR ?? 'data', 'models', file)

/** mỗi lúc chỉ tải một model; đổi model giữa chừng thì lượt tải cũ vẫn chạy cho xong */
let download: { name: WhisperModel; promise: Promise<void>; received: number } | null = null
let downloadError: string | null = null

export type ModelState = 'missing' | 'downloading' | 'ready'

export function whisperLocalStatus() {
  const model = currentModel()
  const downloading = download?.name === model.name
  const state: ModelState = downloading ? 'downloading' : existsSync(modelPath()) ? 'ready' : 'missing'
  return {
    binary: whisperBinary() !== null,
    model: state,
    modelName: model.name,
    modelBytes: model.bytes,
    /** 0–1 khi đang tải */
    progress: downloading ? download!.received / model.bytes : state === 'ready' ? 1 : 0,
    error: downloadError,
  }
}

/** Tải model (chỉ một lượt tải dù gọi nhiều lần), kiểm tra SHA-256 rồi mới đổi tên thành file thật */
export function ensureModel(): Promise<void> {
  const model = currentModel()
  if (existsSync(modelPath(model.file))) return Promise.resolve()
  if (download) {
    if (download.name === model.name) return download.promise
    return Promise.reject(new Error(`Đang tải model Whisper ${download.name}, đợi tải xong rồi thử lại`))
  }

  const state = { name: model.name, received: 0, promise: Promise.resolve() }
  state.promise = (async () => {
    const dest = modelPath(model.file)
    const tmp = `${dest}.download`
    await fs.mkdir(path.dirname(dest), { recursive: true })
    try {
      const res = await fetch(model.url)
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
      if (hash.digest('hex') !== model.sha256) throw new Error('Model Whisper tải về bị lỗi, hãy thử lại')
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
