import type { Accent } from './speech.ts'

export type SoundGroup = 'monophthong' | 'diphthong' | 'consonant'

export interface IpaSound {
  /** khoá ổn định, không đổi theo giọng */
  id: string
  /** ký hiệu theo giọng Anh / Mỹ (khớp với cách src/server/ipa.ts phiên âm) */
  symbol: Record<Accent, string>
  group: SoundGroup
  /** từ ví dụ, `[...]` đánh dấu chữ cái mang âm này */
  examples: string[]
  /** mẹo phát âm cho người Việt */
  tip: string
  /** âm chỉ có ở một giọng (vd. /ɒ/ chỉ có giọng Anh) */
  only?: Accent
}

const both = (s: string) => ({ uk: s, us: s })

export const IPA_SOUNDS: IpaSound[] = [
  // nguyên âm đơn
  {
    id: 'long-i',
    symbol: both('iː'),
    group: 'monophthong',
    examples: ['s[ee]', 'h[ea]t', 'k[ey]', 'p[eo]ple'],
    tip: '"i" kéo dài, môi hơi bè sang hai bên như đang cười.',
  },
  {
    id: 'short-i',
    symbol: both('ɪ'),
    group: 'monophthong',
    examples: ['s[i]t', 'h[i]t', 'b[u]sy', 'w[o]men'],
    tip: '"i" ngắn và lỏng, giữa "i" và "ê". Đừng kéo dài thành /iː/: ship ≠ sheep.',
  },
  {
    id: 'e',
    symbol: both('e'),
    group: 'monophthong',
    examples: ['b[e]d', 'h[ea]d', 's[ai]d', 'm[a]ny'],
    tip: 'Gần "e" tiếng Việt, miệng mở vừa.',
  },
  {
    id: 'ae',
    symbol: both('æ'),
    group: 'monophthong',
    examples: ['c[a]t', 'b[a]d', 'h[a]t', 'm[a]n'],
    tip: 'Giữa "a" và "e": mở miệng rộng, hạ hàm dưới, lưỡi đẩy ra trước. bad ≠ bed.',
  },
  {
    id: 'uh',
    symbol: both('ʌ'),
    group: 'monophthong',
    examples: ['c[u]p', 'l[o]ve', 'bl[oo]d', 'c[ou]ntry'],
    tip: 'Như "ă" ngắn của tiếng Việt, miệng thả lỏng.',
  },
  {
    id: 'long-a',
    symbol: both('ɑː'),
    group: 'monophthong',
    examples: ['f[a]ther', 'c[a]lm', 'h[ear]t', 'p[a]lm'],
    tip: '"a" dài, mở miệng to, lưỡi hạ thấp về phía sau.',
  },
  {
    id: 'short-o',
    symbol: { uk: 'ɒ', us: 'ɑː' },
    group: 'monophthong',
    examples: ['h[o]t', 'd[o]g', 'w[a]tch', 'st[o]p'],
    tip: 'Như "o" ngắn, môi hơi tròn. Giọng Mỹ đọc thành /ɑː/ ("haat").',
    only: 'uk',
  },
  {
    id: 'long-o',
    symbol: both('ɔː'),
    group: 'monophthong',
    examples: ['l[aw]', 't[al]k', 'd[oor]', 'w[a]ter'],
    tip: '"o" dài, môi tròn và đưa ra trước.',
  },
  {
    id: 'short-u',
    symbol: both('ʊ'),
    group: 'monophthong',
    examples: ['b[oo]k', 'p[u]t', 'c[ou]ld', 'w[o]man'],
    tip: '"u" ngắn, môi hơi tròn và lỏng. full ≠ fool.',
  },
  {
    id: 'long-u',
    symbol: both('uː'),
    group: 'monophthong',
    examples: ['f[oo]d', 'bl[ue]', 'tw[o]', 'sh[oe]'],
    tip: '"u" kéo dài, môi chu tròn.',
  },
  {
    id: 'er',
    symbol: { uk: 'ɜː', us: 'ɝː' },
    group: 'monophthong',
    examples: ['b[ir]d', 'w[or]d', 'l[ear]n', 'n[ur]se'],
    tip: 'Như "ơ" dài. Giọng Mỹ cong lưỡi lên thành /ɝː/ ("ơr").',
  },
  {
    id: 'schwa',
    symbol: both('ə'),
    group: 'monophthong',
    examples: ['[a]bout', 'sof[a]', '[a]go', 'pol[i]ce'],
    tip: 'Âm "ơ" rất nhẹ, không nhấn. Âm phổ biến nhất tiếng Anh: hầu hết nguyên âm không nhấn đều thành /ə/.',
  },
  // nguyên âm đôi
  {
    id: 'ei',
    symbol: both('eɪ'),
    group: 'diphthong',
    examples: ['d[ay]', 'm[a]ke', 'r[ai]n', 'th[ey]'],
    tip: 'Trượt từ "ê" sang "i": "êi".',
  },
  {
    id: 'ai',
    symbol: both('aɪ'),
    group: 'diphthong',
    examples: ['m[y]', 't[i]me', 'h[igh]', 'b[uy]'],
    tip: 'Giống "ai" tiếng Việt.',
  },
  {
    id: 'oi',
    symbol: both('ɔɪ'),
    group: 'diphthong',
    examples: ['b[oy]', 'c[oi]n', 'n[oi]se', 'enj[oy]'],
    tip: 'Giống "oi" tiếng Việt.',
  },
  {
    id: 'au',
    symbol: both('aʊ'),
    group: 'diphthong',
    examples: ['n[ow]', 'h[ou]se', 'c[ow]', 'ab[ou]t'],
    tip: 'Giống "ao" tiếng Việt.',
  },
  {
    id: 'ou',
    symbol: { uk: 'əʊ', us: 'oʊ' },
    group: 'diphthong',
    examples: ['g[o]', 'h[o]me', 'kn[ow]', 'b[oa]t'],
    tip: 'Giọng Mỹ "âu" bắt đầu tròn môi (/oʊ/), giọng Anh bắt đầu từ "ơ" (/əʊ/). Đừng đọc thành "ô" đơn.',
  },
  {
    id: 'ia',
    symbol: both('ɪə'),
    group: 'diphthong',
    examples: ['h[ere]', 'n[ear]', 'b[eer]', 'f[ear]'],
    tip: '"ia" như "bia". Giọng Mỹ đọc là /ɪr/.',
    only: 'uk',
  },
  {
    id: 'ea',
    symbol: both('eə'),
    group: 'diphthong',
    examples: ['h[air]', 'wh[ere]', 'c[are]', 'th[eir]'],
    tip: '"e" trượt sang "ơ". Giọng Mỹ đọc là /er/.',
    only: 'uk',
  },
  {
    id: 'ua',
    symbol: both('ʊə'),
    group: 'diphthong',
    examples: ['p[oor]', 't[our]', 's[ure]', 'c[ure]'],
    tip: '"ua" nhẹ. Nhiều người Anh hiện đọc thành /ɔː/. Giọng Mỹ đọc là /ʊr/.',
    only: 'uk',
  },
  // phụ âm
  {
    id: 'p',
    symbol: both('p'),
    group: 'consonant',
    examples: ['[p]en', '[p]ark', 'ha[pp]y', 'sto[p]'],
    tip: 'Bật hơi mạnh ở đầu từ (đặt tờ giấy trước miệng phải rung). Cuối từ vẫn phải bật nhẹ.',
  },
  {
    id: 'b',
    symbol: both('b'),
    group: 'consonant',
    examples: ['[b]ad', '[b]ig', 'ro[b]', 'ca[b]'],
    tip: 'Rung dây thanh. Cuối từ đừng nuốt mất: cab ≠ cap.',
  },
  {
    id: 't',
    symbol: both('t'),
    group: 'consonant',
    examples: ['[t]ea', '[t]ime', 'be[tt]er', 'ca[t]'],
    tip: 'Đầu lưỡi chạm lợi trên, bật hơi (không phải "t" tiếng Việt). Giọng Mỹ: giữa hai nguyên âm đọc nhanh như "đ" (water, better).',
  },
  {
    id: 'd',
    symbol: both('d'),
    group: 'consonant',
    examples: ['[d]og', '[d]ay', 'la[dd]er', 'goo[d]'],
    tip: 'Đầu lưỡi chạm lợi trên, không phải "đ" tiếng Việt. Cuối từ phải phát ra.',
  },
  {
    id: 'k',
    symbol: both('k'),
    group: 'consonant',
    examples: ['[c]at', '[k]ey', 'ba[ck]', '[qu]een'],
    tip: 'Bật hơi ở đầu từ như "kh" nhẹ.',
  },
  {
    id: 'g',
    symbol: both('ɡ'),
    group: 'consonant',
    examples: ['[g]o', '[g]ame', 'bi[g]', 'e[gg]'],
    tip: 'Rung dây thanh, gốc lưỡi chạm vòm mềm.',
  },
  {
    id: 'f',
    symbol: both('f'),
    group: 'consonant',
    examples: ['[f]ish', '[ph]one', 'enou[gh]', 'li[f]e'],
    tip: 'Răng trên chạm môi dưới, thổi hơi.',
  },
  {
    id: 'v',
    symbol: both('v'),
    group: 'consonant',
    examples: ['[v]an', '[v]ery', 'lo[v]e', 'fi[v]e'],
    tip: 'Như /f/ nhưng rung dây thanh. Cuối từ giữ rung: have, love.',
  },
  {
    id: 'th',
    symbol: both('θ'),
    group: 'consonant',
    examples: ['[th]ink', '[th]ree', 'ba[th]', 'mon[th]'],
    tip: 'Đặt đầu lưỡi giữa hai hàm răng, thổi hơi, không rung. Đừng đọc thành "th" hay "t".',
  },
  {
    id: 'dh',
    symbol: both('ð'),
    group: 'consonant',
    examples: ['[th]is', '[th]at', 'mo[th]er', 'brea[th]e'],
    tip: 'Như /θ/ nhưng rung dây thanh. Đừng đọc thành "d" hay "đ".',
  },
  {
    id: 's',
    symbol: both('s'),
    group: 'consonant',
    examples: ['[s]ee', '[c]ity', 'ki[ss]', 'bu[s]'],
    tip: 'Xì hơi qua kẽ răng. Đừng bỏ /s/ cuối từ (số nhiều, ngôi thứ ba).',
  },
  {
    id: 'z',
    symbol: both('z'),
    group: 'consonant',
    examples: ['[z]oo', 'ro[s]e', 'bu[s]y', 'dog[s]'],
    tip: 'Như /s/ nhưng rung, giống tiếng ong "zzz".',
  },
  {
    id: 'sh',
    symbol: both('ʃ'),
    group: 'consonant',
    examples: ['[sh]e', '[sh]ip', 'na[ti]on', 'wi[sh]'],
    tip: 'Môi chu tròn, "s" nặng như suỵt im lặng "shh".',
  },
  {
    id: 'zh',
    symbol: both('ʒ'),
    group: 'consonant',
    examples: ['vi[s]ion', 'mea[s]ure', 'u[s]ual', 'gara[g]e'],
    tip: 'Như /ʃ/ nhưng rung dây thanh.',
  },
  {
    id: 'h',
    symbol: both('h'),
    group: 'consonant',
    examples: ['[h]at', '[h]ouse', '[wh]o', 'be[h]ind'],
    tip: 'Chỉ là hơi thở nhẹ, không khàn như "h" tiếng Việt.',
  },
  {
    id: 'ch',
    symbol: both('tʃ'),
    group: 'consonant',
    examples: ['[ch]air', '[ch]eap', 'wa[tch]', 'na[t]ure'],
    tip: 'Môi chu ra, bật mạnh "ch". Không phải "ch" tiếng Việt.',
  },
  {
    id: 'j',
    symbol: both('dʒ'),
    group: 'consonant',
    examples: ['[j]ob', '[g]ym', 'a[g]e', 'bri[dg]e'],
    tip: 'Như /tʃ/ nhưng rung dây thanh. Không phải "gi" tiếng Việt.',
  },
  {
    id: 'm',
    symbol: both('m'),
    group: 'consonant',
    examples: ['[m]an', '[m]oney', 'su[mm]er', 'ti[m]e'],
    tip: 'Giống "m" tiếng Việt.',
  },
  {
    id: 'n',
    symbol: both('n'),
    group: 'consonant',
    examples: ['[n]o', '[n]ight', 'su[nn]y', 'te[n]'],
    tip: 'Giống "n" tiếng Việt. Cuối từ đặt lưỡi chạm lợi trên rõ ràng.',
  },
  {
    id: 'ng',
    symbol: both('ŋ'),
    group: 'consonant',
    examples: ['si[ng]', 'lo[ng]', 'thi[n]k', 'fi[ng]er'],
    tip: 'Như "ng" tiếng Việt. -ing đọc /ɪŋ/, không phải "inh".',
  },
  {
    id: 'l',
    symbol: both('l'),
    group: 'consonant',
    examples: ['[l]eg', '[l]ight', 'he[ll]o', 'fee[l]'],
    tip: 'Đầu lưỡi chạm lợi trên. Cuối từ (feel, call) giữ lưỡi lại, đừng bỏ hay đọc thành "u".',
  },
  {
    id: 'r',
    symbol: both('r'),
    group: 'consonant',
    examples: ['[r]ed', '[r]ight', 've[r]y', '[wr]ite'],
    tip: 'Cong lưỡi về sau, không chạm vòm miệng, không rung như "r" tiếng Việt.',
  },
  {
    id: 'w',
    symbol: both('w'),
    group: 'consonant',
    examples: ['[w]e', '[w]et', 'a[w]ay', 'q[u]een'],
    tip: 'Chu môi tròn rồi mở ra, giống "qu" / "oa".',
  },
  {
    id: 'y',
    symbol: both('j'),
    group: 'consonant',
    examples: ['[y]es', '[y]ou', '[u]se', 'b[e]auty'],
    tip: 'Giống "d" giọng miền Nam ("da" = ya).',
  },
]

export const GROUP_LABEL: Record<SoundGroup, string> = {
  monophthong: 'Nguyên âm đơn',
  diphthong: 'Nguyên âm đôi',
  consonant: 'Phụ âm',
}

/** "c[a]t" → phần trước / âm đích / phần sau */
export function splitExample(example: string) {
  const m = /^(.*)\[(.+)\](.*)$/.exec(example)
  return m
    ? { before: m[1], mark: m[2], after: m[3] }
    : { before: example, mark: '', after: '' }
}

export const exampleWord = (example: string) => example.replace(/[[\]]/g, '')
