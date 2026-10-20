/** Tạo phụ đề cho audio/video không có sẵn: ước tính trước khi chạy + chạy bằng whisper.cpp hoặc API STT */
import fs from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { settings } from '#/db/schema.ts'
import { getConfig } from './config.ts'
import type { AppConfig } from './config.ts'
import { extractAudioChunks, toWav16kFile } from './media.ts'
import { transcribe } from './stt.ts'
import type { TimedWord } from './transcript/json3.ts'
import { fromSttResults, fromWhisperCppJson } from './transcript/whisper.ts'
import { LOCAL_MODEL, transcribeLocal, whisperLocalStatus } from './whisper-local.ts'

/** Giới hạn để tránh chạy hàng giờ (local) hoặc hoá đơn bất ngờ (API) */
export const MAX_CAPTION_SEC = 3 * 3600

/** Tỉ lệ thời gian xử lý / thời lượng audio của whisper.cpp, đo lại sau mỗi lần chạy */
const RTF_KEY = 'whisperLocalRtf'
const DEFAULT_RTF = 0.3

function localRtf(): number {
  const row = db.select().from(settings).where(eq(settings.key, RTF_KEY)).get()
  const v = Number(row?.value)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_RTF
}

function saveLocalRtf(rtf: number) {
  // trung bình trượt để một lần máy bận không làm lệch hẳn ước tính
  const value = String(+(localRtf() * 0.5 + rtf * 0.5).toFixed(3))
  db.insert(settings).values({ key: RTF_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run()
}

/** USD mỗi phút audio theo model; null = không biết giá */
function sttPricePerMin(cfg: AppConfig): number | null {
  const base = cfg.sttBaseUrl.toLowerCase()
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal/.test(base)) return 0
  const model = cfg.sttModel.toLowerCase()
  if (base.includes('groq')) {
    if (model.includes('turbo')) return 0.04 / 60
    if (model.includes('distil')) return 0.02 / 60
    return 0.111 / 60
  }
  if (model === 'gpt-4o-mini-transcribe') return 0.003
  if (model === 'whisper-1' || model === 'gpt-4o-transcribe') return 0.006
  return null
}

function sttProvider(cfg: AppConfig): string {
  if (!cfg.sttBaseUrl) return 'OpenAI'
  try {
    return new URL(cfg.sttBaseUrl).host
  } catch {
    return cfg.sttBaseUrl
  }
}

export type CaptionEstimate =
  | {
      engine: 'local'
      minutes: number
      model: string
      /** thời gian xử lý ước tính, chưa tính tải model */
      etaSec: number
      /** byte cần tải lần đầu, 0 nếu đã có model */
      downloadBytes: number
      /** lý do chưa chạy được (thiếu whisper-cli) */
      unavailable: string | null
    }
  | {
      engine: 'api'
      minutes: number
      model: string
      provider: string
      usd: number | null
      unavailable: string | null
    }

export function estimateCaptioning(durationSec: number, cfg = getConfig()): CaptionEstimate {
  const minutes = Math.max(1, Math.ceil(durationSec / 60))
  if (cfg.captionEngine === 'local') {
    const status = whisperLocalStatus()
    return {
      engine: 'local',
      minutes,
      model: LOCAL_MODEL.name,
      etaSec: Math.ceil(durationSec * localRtf()),
      downloadBytes: status.model === 'ready' ? 0 : LOCAL_MODEL.bytes,
      unavailable: status.binary
        ? null
        : 'Không tìm thấy whisper-cli trên máy này. Cài whisper.cpp (đặt WHISPER_CPP_PATH) hoặc đổi sang STT API trong Cài đặt.',
    }
  }
  const price = sttPricePerMin(cfg)
  return {
    engine: 'api',
    minutes,
    model: cfg.sttModel,
    provider: sttProvider(cfg),
    usd: price === null ? null : +(price * (durationSec / 60)).toFixed(3),
    unavailable:
      cfg.sttApiKey || cfg.sttBaseUrl ? null : 'Chưa cấu hình Speech-to-Text. Vào Cài đặt để nhập STT API key / Base URL.',
  }
}

export interface CaptionProgress {
  stage: 'downloading-audio' | 'downloading-model' | 'preparing' | 'transcribing'
  /** 0–1 trong giai đoạn hiện tại */
  progress: number
}

/**
 * Tạo danh sách từ có timing từ một file audio/video.
 * `workDir`: thư mục tạm của job, người gọi tự dọn.
 */
export async function generateCaptionWords(
  mediaFile: string,
  opts: {
    durationSec: number
    workDir: string
    signal?: AbortSignal
    onProgress?: (p: CaptionProgress) => void
  },
): Promise<TimedWord[]> {
  const cfg = getConfig()
  const est = estimateCaptioning(opts.durationSec, cfg)
  if (est.unavailable) throw new Error(est.unavailable)
  const report = opts.onProgress ?? (() => {})
  await fs.mkdir(opts.workDir, { recursive: true })

  if (cfg.captionEngine === 'local') {
    report({ stage: 'preparing', progress: 0 })
    const wav = path.join(opts.workDir, 'audio.wav')
    await toWav16kFile(mediaFile, wav, opts.signal)
    const started = Date.now()
    const json = await transcribeLocal(wav, {
      signal: opts.signal,
      onModelProgress: (p) => report({ stage: 'downloading-model', progress: p }),
      onProgress: (p) => report({ stage: 'transcribing', progress: p }),
      onStart: () => report({ stage: 'transcribing', progress: 0 }),
    })
    if (opts.durationSec > 30) saveLocalRtf((Date.now() - started) / 1000 / opts.durationSec)
    return fromWhisperCppJson(json)
  }

  report({ stage: 'preparing', progress: 0 })
  const chunks = await extractAudioChunks(mediaFile, path.join(opts.workDir, 'chunks'), { signal: opts.signal })
  const results = []
  for (const [i, chunk] of chunks.entries()) {
    opts.signal?.throwIfAborted()
    report({ stage: 'transcribing', progress: i / chunks.length })
    const file = new File([await fs.readFile(chunk.path)], path.basename(chunk.path), { type: 'audio/mpeg' })
    results.push({ offsetMs: chunk.offsetMs, result: await transcribe(file, { cfg }) })
  }
  return fromSttResults(results)
}
