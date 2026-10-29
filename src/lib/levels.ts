/** Cấp độ CEFR của danh sách bài nghe */
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type Level = (typeof LEVELS)[number]

export const LEVEL_LABEL: Record<Level, string> = {
  A1: 'Mới bắt đầu',
  A2: 'Sơ cấp',
  B1: 'Trung cấp',
  B2: 'Trung cao cấp',
  C1: 'Cao cấp',
}

/** trang danh sách Khám phá: YouTube không cho lật quá xa, kết quả cuối ít liên quan */
export const CATALOG_MAX_PAGE = 20

/** nguồn bài trên trang Khám phá: video, hội thoại, sách ngữ pháp elllo và tìm kiếm YouTube */
export const CATALOG_SOURCES = ['elllo', 'elllo-views', 'elllo-book', 'youtube'] as const
export type CatalogSource = (typeof CATALOG_SOURCES)[number]

/** cấp CEFR của từ vựng (danh sách CEFR-J + Octanove có thêm C2) */
export const VOCAB_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type VocabLevel = (typeof VOCAB_LEVELS)[number]

/** từ loại trong danh sách CEFR-J → tiếng Việt */
export const POS_VI: Record<string, string> = {
  noun: 'danh từ',
  verb: 'động từ',
  'be-verb': 'động từ',
  'do-verb': 'trợ động từ',
  'have-verb': 'trợ động từ',
  'modal auxiliary': 'động từ khuyết thiếu',
  adjective: 'tính từ',
  adverb: 'trạng từ',
  pronoun: 'đại từ',
  preposition: 'giới từ',
  determiner: 'từ hạn định',
  conjunction: 'liên từ',
  number: 'số từ',
  interjection: 'thán từ',
  'infinitive-to': 'giới từ',
}

export const posVi = (pos: string[]) => [...new Set(pos.map((p) => POS_VI[p] ?? p))].join(', ')
