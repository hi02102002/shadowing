import { describe, expect, it, vi } from 'vitest'

vi.mock('#/db/index.ts', () => ({ db: {} }))
const { batchPages, verifyExtracted } = await import('./user-import')

describe('nhập chunk từ tài liệu của người dùng', () => {
  it('gom trang thành lô và ghi số trang', () => {
    const batches = batchPages(['a'.repeat(4000), 'b'.repeat(4000), '', 'c'])
    expect(batches).toHaveLength(2)
    expect(batches[0].text).toContain('[Trang 1]')
    expect(batches[1].text).toContain('[Trang 2]')
    expect(batches[1].text).toContain('[Trang 4]')
    expect(batches.at(-1)?.lastPage).toBe(4)
  })

  it('chỉ nhận chunk và câu ví dụ có nguyên văn trong tài liệu', () => {
    const page =
      "[Trang 3]\nUseful chunks: at the end of the day; I'd like to ...\nExample: At the end of the day, it's your choice."
    const rows = verifyExtracted(page, [
      {
        text: 'at the end of the day',
        kind: 'formula',
        meaningVi: 'rốt cuộc',
        exampleEn: "At the end of the day, it's your choice.",
        page: 3,
      },
      {
        text: "I'd like to ...",
        kind: 'sentence-frame',
        meaningVi: 'tôi muốn',
        exampleEn: 'I would like to go home.',
        page: 3,
      },
      {
        text: 'break the ice',
        kind: 'formula',
        meaningVi: 'phá băng',
        exampleEn: null,
        page: 3,
      },
      {
        text: 'chunks',
        kind: 'formula',
        meaningVi: '',
        exampleEn: null,
        page: 3,
      },
    ])
    expect(rows.map((r) => r.normalizedText)).toEqual([
      'at the end of the day',
      "i'd like to",
    ])
    expect(rows[0].exampleEn).toBe("At the end of the day, it's your choice.")
    // câu ví dụ AI tự đặt (không có trong tài liệu) bị bỏ
    expect(rows[1].exampleEn).toBeNull()
  })
})
