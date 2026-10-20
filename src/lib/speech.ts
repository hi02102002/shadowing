export type Accent = 'uk' | 'us'

const LANG: Record<Accent, string> = { uk: 'en-GB', us: 'en-US' }

let player: HTMLAudioElement | null = null

/**
 * Đọc mẫu bằng giọng Google (mp3 qua /api/tts, đúng giọng UK/US, có cache).
 * Lỗi mạng thì lùi về giọng TTS của trình duyệt (Electron trên Linux không có giọng nào → im lặng).
 */
export function speak(
  text: string,
  /** giọng chuẩn lấy từ Cài đặt (useAccent) */
  opts: { accent: Accent; rate?: number },
) {
  if (typeof window === 'undefined') return false
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  player?.pause()
  player = new Audio(
    `/api/tts?${new URLSearchParams({ text, accent: opts.accent })}`,
  )
  player.playbackRate = opts.rate ?? 1
  player.play().catch(() => speakWithBrowser(text, opts))
  return true
}

function speakWithBrowser(
  text: string,
  opts: { accent: Accent; rate?: number },
) {
  if (!('speechSynthesis' in window)) return
  const lang = LANG[opts.accent]
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = opts.rate ?? 0.9
  const voices = synth.getVoices()
  // ưu tiên giọng neural/natural đúng accent, sau đó bất kỳ giọng đúng accent, cuối cùng giọng tiếng Anh bất kỳ
  const voice =
    voices.find(
      (v) => v.lang === lang && /natural|neural|google/i.test(v.name),
    ) ??
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith('en'))
  if (voice) u.voice = voice
  synth.speak(u)
}

export const canSpeak = () => typeof window !== 'undefined'
