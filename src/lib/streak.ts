/** ngày theo giờ máy dạng YYYY-MM-DD (khớp date(…, 'localtime') của SQLite) */
export const dayKey = (d: Date) => d.toLocaleDateString('sv-SE')

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/**
 * Chuỗi ngày học liên tiếp: hôm nay chưa học thì vẫn giữ chuỗi tính đến hôm qua (còn cả ngày để giữ chuỗi).
 * `longest`: chuỗi dài nhất từng có.
 */
export function computeStreak(days: Iterable<string>, today: string) {
  const set = new Set(days)
  let cursor = set.has(today) ? today : addDays(today, -1)
  let current = 0
  while (set.has(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const day of [...set].sort()) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = day
  }
  return { current, longest, today: set.has(today) }
}
