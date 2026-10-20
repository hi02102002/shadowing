export type Accent = 'uk' | 'us'

const LANG: Record<Accent, string> = { uk: 'en-GB', us: 'en-US' }

/** Đọc từ bằng giọng TTS của trình duyệt, dùng khi muốn nghe phát âm "chuẩn từ điển" */
export function speak(
  text: string,
  /** giọng chuẩn lấy từ Cài đặt (useAccent) */
  opts: { accent: Accent; rate?: number },
) {
  if (!canSpeak()) return false
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
  return true
}

export const canSpeak = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window
