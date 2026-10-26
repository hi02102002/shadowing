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

/** "1 phút", "10 phút", "3 ngày"… hiện trên nút chấm điểm */
export function formatInterval(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} phút`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} giờ`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} ngày`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo} tháng`
  return `${Math.round(d / 365)} năm`
}

/** hạn ôn của thẻ: "đến hạn" hoặc "sau 3 ngày" */
export function dueLabel(due: Date | number | string) {
  const ms = new Date(due).getTime() - Date.now()
  return ms <= 0 ? 'đến hạn' : `sau ${formatInterval(ms)}`
}
