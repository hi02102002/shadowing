/**
 * Tìm chỗ một từ / cụm từ được nói trong phụ đề có timing từng từ (kiểu YouGlish).
 * Dùng chung cho video trong thư viện (segments.wordsJson) và phụ đề YouTube tải về.
 */
export interface ClipWord {
  w: string
  s: number
  e: number
}

export interface PhraseMatch {
  /** chỉ số từ đầu / cuối (bao gồm) trong mảng words */
  from: number
  to: number
  startMs: number
  endMs: number
  /** true: khớp nguyên dạng; false: khớp dạng chia (-s, -ed, -ing) */
  exact: boolean
}

/** "Don’t," → "don't"; bỏ dấu câu, giữ nháy trong từ rút gọn */
export function normalizeToken(w: string): string {
  return w
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^a-z0-9']+/g, '')
    .replace(/^'+|'+$/g, '')
}

export const phraseTokens = (phrase: string) =>
  phrase.split(/\s+/).map(normalizeToken).filter(Boolean)

/** dạng chia đơn giản của một từ: walk → walks, walked, walking; make → making; stop → stopped */
function inflects(token: string, base: string): boolean {
  if (token === base || !token.startsWith(base.slice(0, -1))) return false
  const stem = base.endsWith('e') ? base.slice(0, -1) : base
  const last = base.at(-1)
  return [
    `${base}s`,
    `${base}es`,
    `${stem}ed`,
    `${stem}ing`,
    `${base}${last}ed`,
    `${base}${last}ing`,
    base.endsWith('y') ? `${base.slice(0, -1)}ies` : '',
    base.endsWith('y') ? `${base.slice(0, -1)}ied` : '',
  ].includes(token)
}

/** Mọi chỗ cụm `phrase` được nói, khớp nguyên từ (fish không khớp selfish), khớp nguyên dạng xếp trước */
export function findPhrase(words: ClipWord[], phrase: string): PhraseMatch[] {
  const target = phraseTokens(phrase)
  if (!target.length) return []
  const tokens = words.map((w) => normalizeToken(w.w))
  const single = target.length === 1
  const out: PhraseMatch[] = []
  for (let i = 0; i + target.length <= tokens.length; i++) {
    let exact = true
    let ok = true
    for (let j = 0; j < target.length; j++) {
      const t = tokens[i + j]
      if (t === target[j]) continue
      // chỉ từ đơn mới nhận dạng chia, cụm từ phải khớp nguyên văn
      if (single && inflects(t, target[j])) exact = false
      else {
        ok = false
        break
      }
    }
    if (!ok) continue
    const to = i + target.length - 1
    out.push({ from: i, to, startMs: words[i].s, endMs: words[to].e, exact })
  }
  return out.sort((a, b) => Number(b.exact) - Number(a.exact))
}

/** khoảng nghe thêm trước / sau cụm từ để có ngữ cảnh */
export const CLIP_CONTEXT_MS = 1500

export interface ClipContext {
  /** đoạn phát: cụm từ ± CLIP_CONTEXT_MS, không vượt ra ngoài câu (nếu biết câu) */
  startMs: number
  endMs: number
  /** câu chứa cụm từ */
  sentence: string
  /** vị trí ký tự [from, to) của cụm từ trong `sentence` để tô đậm */
  highlight: [number, number]
}

/**
 * Câu quanh chỗ khớp: lấy các từ cùng câu (giới hạn bởi `bounds` nếu có, không thì
 * ±CLIP_CONTEXT_MS) và vị trí cụm từ trong câu.
 */
export function clipContext(
  words: ClipWord[],
  match: PhraseMatch,
  bounds?: { startMs: number; endMs: number },
): ClipContext {
  const lo = Math.max(
    bounds?.startMs ?? -Infinity,
    match.startMs - CLIP_CONTEXT_MS,
  )
  const hi = Math.min(bounds?.endMs ?? Infinity, match.endMs + CLIP_CONTEXT_MS)
  let first = match.from
  while (first > 0 && words[first - 1].s >= lo) first--
  let last = match.to
  while (last < words.length - 1 && words[last + 1].e <= hi) last++

  let sentence = ''
  let hFrom = 0
  let hTo = 0
  for (let i = first; i <= last; i++) {
    const w = words[i].w.trim()
    if (!w) continue
    if (sentence) sentence += ' '
    if (i === match.from) hFrom = sentence.length
    sentence += w
    if (i === match.to) hTo = sentence.length
  }
  return {
    startMs: Math.max(0, Math.min(lo, words[first].s)),
    endMs: Math.max(hi === Infinity ? match.endMs : hi, words[last].e),
    sentence,
    highlight: [hFrom, hTo],
  }
}
