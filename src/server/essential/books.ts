/** Danh sách sách từ vựng trên essentialenglish.review (mục Vocabulary) */

export const EE_BASE = 'https://www.essentialenglish.review/apps-data/'

/**
 * wordlist: data.json có sẵn mảng wordlist cho mỗi unit
 * html: danh sách từ nằm trong HTML của unit (<li word img pro>), bản 2nd Edition
 */
export type VocabFormat = 'wordlist' | 'html'

export interface VocabBook {
  /** thư mục ảnh/audio trên site, cũng là id của sách trong app */
  slug: string
  /** thư mục chứa data.json nếu khác slug (site đặt nhầm data của bản 2nd Edition) */
  dataSlug?: string
  title: string
  series: string
  format: VocabFormat
  /** ảnh minh hoạ từng từ có trên site (Verbal Advantage, English Vocabulary in Use thì không) */
  images: boolean
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

const EEW = '4000 Essential English Words'
const EEW2 = '4000 Essential English Words · 2nd Edition'
const VA = 'Verbal Advantage'
const IEE = 'Illustrated Everyday Expressions with Stories'
const EVIU = 'English Vocabulary in Use'

export const VOCAB_BOOKS: VocabBook[] = [
  ...range(6).map((n) => ({
    slug: `4000-essential-english-words-${n}`,
    title: `${EEW} ${n}`,
    series: EEW,
    format: 'wordlist' as const,
    images: true,
  })),
  // data.json bản 2nd Edition trên site bị lệch: quyển 2 nằm ở thư mục quyển 3, quyển 3 ở thư mục quyển 4
  // (5, 6 là bản sao của 4); ảnh/audio thì đúng thư mục → chỉ có đủ 3 quyển đầu
  ...[1, 2, 3].map((n) => ({
    slug: `4000-essential-english-words-${n}-2nd-edition`,
    dataSlug: `4000-essential-english-words-${n === 1 ? 1 : n + 1}-2nd-edition`,
    title: `${EEW} ${n} (2nd Edition)`,
    series: EEW2,
    format: 'html' as const,
    images: true,
  })),
  ...range(10).map((n) => ({
    slug: `verbal-advantage-level-${String(n).padStart(2, '0')}`,
    title: `${VA} Level ${n}`,
    series: VA,
    format: 'wordlist' as const,
    images: false,
  })),
  ...range(2).map((n) => ({
    slug: `illustrated-everyday-expressions-with-stories-${n}`,
    title: `${IEE} ${n}`,
    series: IEE,
    format: 'wordlist' as const,
    images: true,
  })),
  ...(
    [
      ['elementary', 'Elementary'],
      ['pre-intermediate-and-intermediate', 'Pre-intermediate & Intermediate'],
      ['upper-intermediate', 'Upper-intermediate'],
      ['advanced', 'Advanced'],
    ] as const
  ).map(([slug, level]) => ({
    slug: `english-vocabulary-in-use-${slug}`,
    title: `${EVIU} ${level}`,
    series: EVIU,
    format: 'wordlist' as const,
    images: false,
  })),
]

export const findBook = (slug: string) => VOCAB_BOOKS.find((b) => b.slug === slug)
