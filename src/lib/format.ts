export function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function formatDuration(sec: number | null | undefined) {
  if (!sec) return ''
  return formatTime(sec * 1000)
}

export function relativeTime(date: Date | number | string) {
  const d = new Date(date)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày trước`
  return d.toLocaleDateString('vi-VN')
}

/** Màu theo điểm: ≥85 tốt, ≥60 khá, còn lại cần luyện */
export function scoreTone(score: number | null | undefined) {
  if (score == null) return 'none' as const
  if (score >= 85) return 'ok' as const
  if (score >= 60) return 'miss' as const
  return 'bad' as const
}
