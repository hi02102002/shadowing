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

/** /api/tts chỉ đọc tối đa 200 ký tự: tách theo câu, câu quá dài thì tách tiếp theo dấu phẩy / khoảng trắng */
export function splitForSpeech(text: string, max = 200): string[] {
  const out: string[] = []
  for (const sentence of text.match(/[^.!?]+[.!?]*/g) ?? []) {
    let rest = sentence.trim()
    while (rest.length > max) {
      const cut = Math.max(rest.lastIndexOf(', ', max), rest.lastIndexOf(' ', max))
      const at = cut > 0 ? cut + 1 : max
      out.push(rest.slice(0, at).trim())
      rest = rest.slice(at).trim()
    }
    if (rest) out.push(rest)
  }
  return out
}

/** Đọc đoạn nhiều câu, nối từng phần một; gọi speak/speakLong khác sẽ dừng đoạn đang đọc */
export function speakLong(text: string, opts: { accent: Accent; rate?: number }) {
  const parts = splitForSpeech(text)
  const next = (i: number) => {
    if (i >= parts.length) return
    speak(parts[i], opts)
    const current = player
    current?.addEventListener('ended', () => current === player && next(i + 1), { once: true })
  }
  next(0)
}
