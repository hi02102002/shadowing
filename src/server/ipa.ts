/** Phiên âm IPA giọng Mỹ hoặc Anh từ từ điển phát âm CMU, chạy offline không cần AI */
import type { Accent } from '#/lib/speech.ts'

const VOWELS: Record<string, [stressed: string, unstressed: string]> = {
  AA: ['ɑː', 'ɑː'],
  AE: ['æ', 'æ'],
  AH: ['ʌ', 'ə'],
  AO: ['ɔː', 'ɔː'],
  AW: ['aʊ', 'aʊ'],
  AY: ['aɪ', 'aɪ'],
  EH: ['e', 'e'],
  ER: ['ɝː', 'ɚ'],
  EY: ['eɪ', 'eɪ'],
  IH: ['ɪ', 'ɪ'],
  IY: ['iː', 'i'],
  OW: ['oʊ', 'oʊ'],
  OY: ['ɔɪ', 'ɔɪ'],
  UH: ['ʊ', 'ʊ'],
  UW: ['uː', 'u'],
}

const CONSONANTS: Record<string, string> = {
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  F: 'f',
  G: 'ɡ',
  HH: 'h',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  P: 'p',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  V: 'v',
  W: 'w',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
}

/** cụm phụ âm được phép đứng đầu âm tiết → đặt dấu nhấn trước cả cụm (ˈstr…, ˈpl…) */
const ONSETS = new Set([
  'pl',
  'pr',
  'bl',
  'br',
  'tr',
  'dr',
  'kl',
  'kr',
  'ɡl',
  'ɡr',
  'fl',
  'fr',
  'θr',
  'ʃr',
  'sp',
  'st',
  'sk',
  'sm',
  'sn',
  'sl',
  'sw',
  'kw',
  'tw',
  'dw',
  'ɡw',
  'pj',
  'bj',
  'fj',
  'vj',
  'kj',
  'mj',
  'hj',
  'spl',
  'spr',
  'str',
  'skr',
  'skw',
  'skj',
])

/** nguyên âm + r cuối âm tiết trong giọng Anh (không phát âm r) */
const UK_R_VOWEL: Record<string, string> = {
  AA: 'ɑː',
  AO: 'ɔː',
  EH: 'eə',
  EY: 'eə',
  IH: 'ɪə',
  IY: 'ɪə',
  UH: 'ʊə',
  UW: 'ʊə',
  AY: 'aɪə',
  AW: 'aʊə',
}

const isVowel = (p: string | undefined) => !!p && /\d$/.test(p)

/**
 * Giọng Anh (RP) suy ra từ dữ liệu giọng Mỹ của CMU: không phát âm r cuối âm tiết, /oʊ/ → /əʊ/,
 * /ɝː ɚ/ → /ɜː ə/, nguyên âm "lot" → /ɒ/ và một phần nhóm "bath" → /ɑː/.
 * Hai nhóm cuối phụ thuộc từng từ nên đoán theo chính tả (`spelling`).
 */
function ukVowel(
  base: string,
  stressed: boolean,
  next: string[],
  spelling: string,
): string | null {
  switch (base) {
    case 'OW':
      return 'əʊ'
    case 'ER':
      return stressed ? 'ɜː' : 'ə'
    case 'AA':
      // CMU gộp "caught" với "cot" (giọng Mỹ) → tách lại theo chính tả
      if (/au|aw|ough/.test(spelling)) return 'ɔː'
      // "lot", "watch" → ɒ; "father", "calm" → ɑː
      return /o|wa|qua/.test(spelling) ? 'ɒ' : 'ɑː'
    case 'AO':
      // "talk", "law", "caught", "water" → ɔː; "dog", "long", "off" → ɒ
      return /au|aw|al|ough|wa/.test(spelling) ? 'ɔː' : 'ɒ'
    case 'AE': {
      // nhóm "bath": ask, after, path, dance, answer → ɑː
      if (!stressed) return null
      const [n1, n2, n3] = next.map((p) => p.replace(/\d$/, ''))
      const bath =
        n1 === 'F' ||
        n1 === 'TH' ||
        // fast, ask — nhưng không phải -stic (fantastic, plastic)
        (n1 === 'S' && ['K', 'P', 'T'].includes(n2) && n3 !== 'IH') ||
        (n1 === 'N' && ['S', 'CH'].includes(n2))
      return bath ? 'ɑː' : null
    }
    default:
      return null
  }
}

export function arpabetToIpa(
  arpabet: string,
  accent: Accent = 'us',
  spelling = '',
): string {
  const phones = arpabet.trim().split(/\s+/)
  const vowelCount = phones.filter(isVowel).length
  const out: string[] = []
  // phụ âm đang chờ: có thể thành onset của âm tiết có nhấn phía sau
  let pending: string[] = []

  const flush = (stressMark: string) => {
    let split = pending.length
    // lấy cụm onset dài nhất hợp lệ ở cuối dãy phụ âm
    for (let n = Math.min(3, pending.length); n >= 1; n--) {
      const cluster = pending.slice(-n)
      if (n === 1 || ONSETS.has(cluster.join(''))) {
        split = pending.length - n
        break
      }
    }
    out.push(...pending.slice(0, split), stressMark, ...pending.slice(split))
    pending = []
  }

  for (let i = 0; i < phones.length; i++) {
    const m = /^([A-Z]+)(\d)?$/.exec(phones[i])
    if (!m) continue
    const base = m[1]
    const stress = m[2] as string | undefined
    if (stress === undefined) {
      pending.push(CONSONANTS[base] ?? base.toLowerCase())
      continue
    }
    const stressed = stress !== '0'
    // từ một âm tiết không cần dấu nhấn
    const mark =
      vowelCount > 1 ? (stress === '1' ? 'ˈ' : stress === '2' ? 'ˌ' : '') : ''
    flush(mark)

    const vowel = VOWELS[base] as (typeof VOWELS)[string] | undefined
    let symbol = vowel ? vowel[stressed ? 0 : 1] : base.toLowerCase()
    if (accent === 'uk') {
      const rNotPronounced = phones[i + 1] === 'R' && !isVowel(phones[i + 2])
      if (rNotPronounced && UK_R_VOWEL[base]) {
        symbol = UK_R_VOWEL[base]
        i++ // bỏ r
      } else {
        symbol =
          ukVowel(base, stressed, phones.slice(i + 1, i + 4), spelling) ??
          symbol
        // ER đứng trước nguyên âm vẫn giữ r: "interest", "every"
        if (base === 'ER' && isVowel(phones[i + 1])) symbol += 'r'
      }
    }
    out.push(symbol)
  }
  out.push(...pending)
  return out.join('')
}

let dict: Record<string, string> | null = null

async function dictionary() {
  // ~4MB, chỉ nạp khi cần lần đầu
  dict ??= (await import('cmu-pronouncing-dictionary')).dictionary
  return dict
}

const normalize = (word: string) =>
  word
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '')
    .replace(/^'+|'+$/g, '')

/** chỉ tra từ toàn chữ cái: "A1", "2024" không có cách đọc trong từ điển */
const isWord = (w: string) => /^[a-z']+$/.test(w)

/** IPA cho từng từ (giữ nguyên thứ tự), null nếu không có trong từ điển */
export async function wordsToIpa(
  words: string[],
  accent: Accent = 'us',
): Promise<Array<string | null>> {
  const d = await dictionary()
  return words.map((raw) => {
    const w = normalize(raw)
    if (!isWord(w)) return null
    const direct = d[w]
    if (direct) return arpabetToIpa(direct, accent, w)
    // sở hữu cách không có trong từ điển: john's → john + z
    const base = /^(.+)'s$/.exec(w)?.[1]
    if (base && d[base]) {
      const ipa = arpabetToIpa(d[base], accent, base)
      return (
        ipa +
        (/[sz]$|[ʃʒ]$|tʃ$|dʒ$/.test(ipa)
          ? 'ɪz'
          : /[ptkfθ]$/.test(ipa)
            ? 's'
            : 'z')
      )
    }
    return null
  })
}
