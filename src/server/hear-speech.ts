import { transcribeWithAudioLlm } from './ai/audio-assess.ts'
import { toWav16k } from './audio.ts'
import { getConfig, hasAudioLlm, hasStt } from './config.ts'
import { transcribeOnDevice } from './on-device-stt.ts'
import { transcribe } from './stt.ts'

/**
 * Nhận dạng lời nói tự do (không có câu mẫu), theo cùng thứ tự với chấm phát âm:
 * LLM nghe audio (nếu Cài đặt chọn) → STT API → Whisper trên máy
 */
export async function hearSpeech(audio: File) {
  const cfg = getConfig()
  const llmAudio = cfg.pronunciationEngine === 'llm-audio' && hasAudioLlm(cfg)
  if (!llmAudio && hasStt(cfg)) return (await transcribe(audio, { cfg })).text.trim()
  const { wav, durationMs } = await toWav16k(Buffer.from(await audio.arrayBuffer()))
  if (durationMs < 400) throw new Error('Bản ghi quá ngắn, hãy nói lại')
  if (llmAudio) return transcribeWithAudioLlm(wav, cfg)
  return (await transcribeOnDevice(wav)).map((w) => w.word).join(' ').replace(/\s+/g, ' ').trim()
}
