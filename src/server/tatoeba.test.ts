import { afterEach, describe, expect, it, vi } from 'vitest'
import { tatoebaExamples } from './tatoeba'

const vie = (text: string) => ({ text, lang: 'vie' })

function mockApi(data: unknown[]) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('tatoebaExamples', () => {
  it('chỉ lấy câu đã duyệt có bản dịch tiếng Việt, câu chứa đúng từ lên trước', async () => {
    mockApi([
      { id: 1, text: 'She is my relative.', translations: [vie('Cô ấy là họ hàng của tôi.')] },
      { id: 2, text: 'All my relatives came.', translations: [{ text: 'Alle kamen.', lang: 'deu' }] },
      { id: 3, text: 'Bad relatives sentence here.', is_unapproved: true, translations: [vie('x')] },
      // bản dịch gián tiếp nằm trong mảng con
      { id: 4, text: 'My relatives live in Hue.', translations: [[vie('Họ hàng tôi sống ở Huế.')]] },
    ])
    expect(await tatoebaExamples('relatives')).toEqual([
      { en: 'My relatives live in Hue.', vi: 'Họ hàng tôi sống ở Huế.', src: 'https://tatoeba.org/en/sentences/show/4' },
      { en: 'She is my relative.', vi: 'Cô ấy là họ hàng của tôi.', src: 'https://tatoeba.org/en/sentences/show/1' },
    ])
  })

  it('cụm nhiều từ thì tìm nguyên cụm, câu 4–12 từ, ngắn trước', async () => {
    const fetchMock = mockApi([])
    await tatoebaExamples('have a baby')
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]))
    expect(url.searchParams.get('q')).toBe('"have a baby"')
    expect(url.searchParams.get('word_count')).toBe('4-12')
    expect(url.searchParams.get('sort')).toBe('words')
    expect(url.searchParams.get('trans:lang')).toBe('vie')
  })
})
