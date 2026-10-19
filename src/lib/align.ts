/**
 * Căn chỉnh từng từ giữa câu gốc (reference) và câu người học (hypothesis)
 * bằng Levenshtein ở mức token. Dùng chung cho dictation và pronunciation.
 */

export type AlignOp = 'correct' | 'wrong' | 'missing' | 'extra'

export interface AlignToken {
  op: AlignOp
  /** từ trong câu gốc (hiển thị nguyên dạng) — rỗng với `extra` */
  ref: string
  /** từ người học nhập/nói — rỗng với `missing` */
  hyp: string
  /** vị trí từ trong câu gốc, -1 với `extra` */
  refIndex: number
  /** vị trí từ trong câu người học, -1 với `missing` */
  hypIndex: number
}

export interface AlignResult {
  tokens: AlignToken[]
  correct: number
  refCount: number
  /** % từ đúng trên tổng số từ câu gốc, trừ điểm cho từ thừa */
  score: number
}

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "what's": 'what is',
  "he's": 'he is',
  "she's": 'she is',
  "let's": 'let us',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "we'll": 'we will',
  "they'll": 'they will',
  "it'll": 'it will',
  "i'd": 'i would',
  "you'd": 'you would',
  "we'd": 'we would',
  "they'd": 'they would',
  "can't": 'can not',
  cannot: 'can not',
  "won't": 'will not',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not',
  "shouldn't": 'should not',
  "wouldn't": 'would not',
  "couldn't": 'could not',
  gonna: 'going to',
  wanna: 'want to',
  gotta: 'got to',
  ok: 'okay',
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** 0..999 → chữ (đủ cho phụ đề thông thường); số lớn hơn giữ nguyên */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) return String(n)
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
  const rest = n % 100
  return ONES[Math.floor(n / 100)] + ' hundred' + (rest ? ' ' + numberToWords(rest) : '')
}

/** Tách câu thành các từ hiển thị (giữ nguyên chữ hoa/dấu câu) */
export function displayWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => normalizeWord(w).length > 0)
}

/** Chuẩn hoá một từ để so sánh: lowercase, bỏ dấu câu, thống nhất dấu nháy */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^a-z0-9']/g, '')
    .replace(/^'+|'+$/g, '')
}

/**
 * Chuẩn hoá một từ hiển thị thành 1..n token so sánh
 * ("don't" → ["do","not"], "20" → ["twenty"]).
 */
export function expandWord(word: string): string[] {
  const w = normalizeWord(word)
  if (!w) return []
  if (CONTRACTIONS[w]) return CONTRACTIONS[w].split(' ')
  if (/^\d+$/.test(w)) return numberToWords(Number(w)).split(' ')
  // sở hữu cách / 's rút gọn còn lại: so sánh theo gốc
  return [w]
}

interface Unit {
  key: string
  display: string
  /** index từ hiển thị gốc */
  wordIndex: number
}

function toUnits(text: string): Unit[] {
  const units: Unit[] = []
  displayWords(text).forEach((display, wordIndex) => {
    for (const key of expandWord(display)) units.push({ key, display, wordIndex })
  })
  return units
}

/** Levenshtein mức ký tự */
function charDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/**
 * Chi phí thay thế ∈ (0, 1]: hai từ càng giống nhau ("sell"/"sells") càng rẻ,
 * nhờ vậy được ghép cặp với nhau thay vì với một từ khác hẳn.
 */
function substitutionCost(a: string, b: string): number {
  if (a === b) return 0
  return 0.3 + 0.7 * (charDistance(a, b) / Math.max(a.length, b.length))
}

const EPS = 1e-9

/**
 * Căn chỉnh Levenshtein mức token. Kết quả gom về mức từ hiển thị của câu gốc
 * để "don't" bị nghe thành "do" vẫn hiện là một từ sai thay vì hai mảnh.
 */
export function alignWords(reference: string, hypothesis: string): AlignResult {
  const ref = toUnits(reference)
  const hyp = toUnits(hypothesis)
  const n = ref.length
  const m = hyp.length

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i++) dp[i][0] = i
  for (let j = 0; j <= m; j++) dp[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + substitutionCost(ref[i - 1].key, hyp[j - 1].key),
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
      )
    }
  }

  // truy vết
  type Step = { op: AlignOp; r?: Unit; h?: Unit }
  const steps: Step[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      Math.abs(dp[i][j] - (dp[i - 1][j - 1] + substitutionCost(ref[i - 1].key, hyp[j - 1].key))) < EPS
    ) {
      steps.push({
        op: ref[i - 1].key === hyp[j - 1].key ? 'correct' : 'wrong',
        r: ref[i - 1],
        h: hyp[j - 1],
      })
      i--
      j--
    } else if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + 1)) < EPS) {
      steps.push({ op: 'missing', r: ref[i - 1] })
      i--
    } else {
      steps.push({ op: 'extra', h: hyp[j - 1] })
      j--
    }
  }
  steps.reverse()

  // gom các bước về từng từ hiển thị của câu gốc
  const tokens: AlignToken[] = []
  let current: { wordIndex: number; ops: Step[] } | null = null
  const flush = () => {
    if (!current) return
    const { ops, wordIndex } = current
    const r = ops.find((s) => s.r)!.r!
    const hypUnits = ops.filter((s) => s.h).map((s) => s.h!)
    const hypWords = [...new Map(hypUnits.map((u) => [u.wordIndex, u.display])).values()]
    const allCorrect = ops.every((s) => s.op === 'correct')
    const allMissing = ops.every((s) => s.op === 'missing')
    tokens.push({
      op: allCorrect ? 'correct' : allMissing ? 'missing' : 'wrong',
      ref: r.display,
      hyp: hypWords.join(' '),
      refIndex: wordIndex,
      hypIndex: hypUnits[0]?.wordIndex ?? -1,
    })
    current = null
  }

  for (let k = 0; k < steps.length; k++) {
    const step = steps[k]
    if (step.op === 'extra') {
      // extra nằm giữa các mảnh của cùng một từ gốc ("don't" → "do … not") → gộp vào từ đó
      const nextRef = steps.slice(k + 1).find((s) => s.r)?.r
      if (current && nextRef?.wordIndex === current.wordIndex) {
        current.ops.push(step)
        continue
      }
      flush()
      tokens.push({ op: 'extra', ref: '', hyp: step.h!.display, refIndex: -1, hypIndex: step.h!.wordIndex })
      continue
    }
    const wi = step.r!.wordIndex
    if (current && current.wordIndex !== wi) flush()
    if (!current) current = { wordIndex: wi, ops: [] }
    current.ops.push(step)
  }
  flush()

  // khử trùng lặp hyp: một từ người học bị chia cho nhiều từ gốc vẫn giữ nguyên
  const refCount = displayWords(reference).length
  const correct = tokens.filter((t) => t.op === 'correct').length
  const extra = tokens.filter((t) => t.op === 'extra').length
  const score = refCount === 0 ? 0 : Math.max(0, Math.round(((correct - extra * 0.5) / refCount) * 100))

  return { tokens, correct, refCount, score }
}

/** Gợi ý dictation: hiện chữ cái đầu của mỗi từ, phần còn lại thay bằng "_" */
export function firstLetterHint(text: string): string {
  return displayWords(text)
    .map((w) => w.replace(/[A-Za-z0-9]/g, (c, idx: number) => (idx === w.search(/[A-Za-z0-9]/) ? c : '_')))
    .join(' ')
}
