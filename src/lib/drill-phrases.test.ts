import { describe, expect, it } from 'vitest'

import { splitDrill } from './drill-phrases'

const spoken = (s: string) => splitDrill(s).flatMap((p) => (p.speak ? [p.speak] : []))

describe('splitDrill', () => {
  it('lấy các cụm tiếng Anh trong nháy đơn', () => {
    expect(
      spoken("Luyện cặp từ chứa âm /ʃ/: 'fresh fish' - chú ý chu môi và xì hơi nhẹ ở cả hai từ mà không ngắt thành âm /t/."),
    ).toEqual(['fresh fish'])
    expect(spoken("Luyện âm đuôi số nhiều /z/: 'salads' /ˈsælədz/ và 'vegetables' /ˈvedʒtəblz/.")).toEqual([
      'salads',
      'vegetables',
    ])
    expect(
      spoken("Nối âm nhẹ nhàng: 'fan of' -> /fæn əv/, 'plenty of' -> /ˈplenti əv/ để câu nói mượt mà hơn."),
    ).toEqual(['fan of', 'plenty of'])
  })

  it('giữ nháy trong từ rút gọn và nhận nháy cong / nháy kép', () => {
    expect(spoken("Đọc 'I don't know.' thật nhanh")).toEqual(["I don't know."])
    expect(spoken('Đọc “plenty of” rồi "a lot of"')).toEqual(['plenty of', 'a lot of'])
  })

  it('bỏ qua chữ tiếng Việt trong nháy và giữ nguyên toàn văn', () => {
    const s = "Chú ý 'chu môi' khi đọc 'fish'"
    expect(spoken(s)).toEqual(['fish'])
    expect(
      splitDrill(s)
        .map((p) => p.text)
        .join(''),
    ).toBe(s)
  })
})
