export type DrillPart = { text: string; speak?: string }

// cụm tiếng Anh trong nháy đơn/kép/cong: 'fresh fish', “plenty of”, 'don't' (nháy giữa chữ không tính là đóng)
const QUOTED = /(['‘"“])([A-Za-z][A-Za-z0-9' ,.?!-]*?[A-Za-z.?!])['’"”](?![A-Za-z])/g

/**
 * Tách bài tập AI ("Luyện cặp từ 'fresh fish' - chú ý…") thành các đoạn chữ thường và đoạn tiếng Anh
 * đọc được (`speak`), để gắn nút nghe mẫu vào đúng từ/cụm cần luyện.
 */
export function splitDrill(drill: string): DrillPart[] {
  const parts: DrillPart[] = []
  let last = 0
  for (const m of drill.matchAll(QUOTED)) {
    const start = m.index
    if (start > last) parts.push({ text: drill.slice(last, start) })
    parts.push({ text: m[0], speak: m[2] })
    last = start + m[0].length
  }
  if (last < drill.length) parts.push({ text: drill.slice(last) })
  return parts
}
