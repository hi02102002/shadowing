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
