/** Nhận diện chunk (cụm nhiều từ) trong một đoạn văn: so khớp chuỗi token đã chuẩn hoá, dài nhất trước. */

/** cùng cách chuẩn hoá với scripts/chunks/build-chunks.mjs */
export const normalizeChunk = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const MAX_WORDS = 6

export interface ChunkMatcher<T> {
  /** các chunk xuất hiện trong text, theo thứ tự gặp lần đầu, mỗi chunk một lần */
  find: (text: string) => Array<{ item: T; surface: string }>
}

/**
 * entries: [dạng chuẩn hoá, item]. Một vị trí chỉ nhận cụm dài nhất bắt đầu ở đó,
 * để "give up on" không bị đếm thêm "give up".
 */
export function createChunkMatcher<T>(
  entries: Iterable<readonly [string, T]>,
): ChunkMatcher<T> {
  const index = new Map<string, T[]>()
  for (const [form, item] of entries) {
    const key = normalizeChunk(form)
    const words = key.split(' ').length
    if (words < 2 || words > MAX_WORDS) continue
    const list = index.get(key)
    if (list) {
      if (!list.includes(item)) list.push(item)
    } else index.set(key, [item])
  }

  return {
    find(text) {
      // giữ vị trí token trong text gốc để trả lại đúng chữ người học thấy
      const tokens = [...text.matchAll(/[A-Za-z0-9]+(?:['’][A-Za-z]+)?/g)].map(
        (m) => ({
          word: normalizeChunk(m[0]),
          start: m.index,
          end: m.index + m[0].length,
        }),
      )
      const seen = new Set<T>()
      const out: Array<{ item: T; surface: string }> = []
      for (let i = 0; i < tokens.length; i++)
        for (let n = Math.min(MAX_WORDS, tokens.length - i); n >= 2; n--) {
          const key = tokens
            .slice(i, i + n)
            .map((t) => t.word)
            .join(' ')
          const items = index.get(key)
          if (!items) continue
          for (const item of items)
            if (!seen.has(item)) {
              seen.add(item)
              out.push({
                item,
                surface: text.slice(tokens[i].start, tokens[i + n - 1].end),
              })
            }
          break
        }
      return out
    },
  }
}
