/** Nhận dạng giọng nói bằng whisper.cpp trên máy, dùng chung cho chấm phát âm và hội thoại (chỉ chạy ở server) */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { SttWord } from './stt.ts'
import { fromWhisperCppJson } from './transcript/whisper.ts'
import { ensureModel, transcribeLocal, whisperBinary, whisperLocalStatus, PRONUNCIATION_MODEL } from './whisper-local.ts'

/** Nhận dạng bản ghi bằng whisper.cpp trên máy (không cần API) */
export async function transcribeOnDevice(wav: Buffer): Promise<SttWord[]> {
  if (!whisperBinary()) {
    throw new Error(
      'Chưa cấu hình AI và không tìm thấy whisper-cli để chấm trên máy. Vào Cài đặt để nhập API key.',
    )
  }
  const status = whisperLocalStatus(PRONUNCIATION_MODEL)
  if (status.model !== 'ready') {
    // tải ở nền (vài trăm MB) thay vì bắt người dùng chờ trong lúc chấm
    ensureModel(PRONUNCIATION_MODEL).catch(() => {
      /* lỗi được ghi vào whisperLocalStatus().error */
    })
    const pct = Math.round(whisperLocalStatus(PRONUNCIATION_MODEL).progress * 100)
    throw new Error(
      `Chưa cấu hình AI nên app chấm phát âm trên máy bằng Whisper. Đang tải model (${pct}%), thử lại sau ít phút — xem tiến độ ở Cài đặt.`,
    )
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'shadowing-pron-'))
  try {
    const wavPath = path.join(dir, 'rec.wav')
    await fs.writeFile(wavPath, wav)
    return fromWhisperCppJson(await transcribeLocal(wavPath, { model: PRONUNCIATION_MODEL })).map((w) => ({
      word: w.w,
      start: w.s / 1000,
      end: w.e / 1000,
    }))
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}
