import { describe, expect, it } from 'vitest'

import { parseIteslJIndex, parseIteslJQuestions } from './iteslj'
import { nearLevels, pickBank } from './sources'
import { parseTatoeba, tatoebaUrl } from './tatoeba'

describe('iTESLj', () => {
  it('đọc mục lục chủ đề trong .topics-grid, bỏ trùng', () => {
    const html = `<a href="../index.html">Home</a>
      <ul class="topics-grid">
        <li><a href="accidents.html">Accidents at Home</a></li>
        <li><a href="animals.html">Animals &amp; Pets</a></li>
        <li><a href="animals.html">Animals again</a></li>
      </ul>`
    expect(parseIteslJIndex(html)).toEqual([
      { slug: 'accidents', title: 'Accidents at Home' },
      { slug: 'animals', title: 'Animals & Pets' },
    ])
  })

  it('chỉ lấy câu hỏi cấp ngoài, bỏ câu hỏi phụ lồng và câu bị gộp', () => {
    const html = `<ul>
<li>How old were you when you went on your first flight?<ul><li>Where did you go?</ul>
<li>Can you sleep during the flight?
<li>Where can you hang your coats after boarding an airplane? 5. What do you do when you get blocked ears?
<li>Hello there
</ul>
<center>footer</center>`
    const qs = parseIteslJQuestions(html).map((q) => q.question)
    expect(qs).toEqual([
      'How old were you when you went on your first flight?',
      'Can you sleep during the flight?',
      'Where can you hang your coats after boarding an airplane?',
    ])
    expect(parseIteslJQuestions(html)[1].level).toBe('A2')
  })
})

describe('Tatoeba', () => {
  it('url lọc theo số âm tiết tiếng Việt', () => {
    const url = new URL(tatoebaUrl('B1', 30))
    expect(url.searchParams.get('lang')).toBe('vie')
    expect(url.searchParams.get('trans:lang')).toBe('eng')
    expect(url.searchParams.get('word_count')).toBe('11-15')
  })

  it('ưu tiên bản dịch trực tiếp, bỏ câu chưa duyệt, giữ ghi nguồn', () => {
    const json = {
      data: [
        {
          id: 1,
          text: 'Đã bảy giờ rồi.',
          owner: 'duythanh',
          license: 'CC BY 2.0 FR',
          translations: [
            { id: 9, text: 'Seven already.', lang: 'eng', is_direct: false },
            {
              id: 2,
              text: "It's already seven o'clock.",
              lang: 'eng',
              is_direct: true,
              owner: 'CK',
            },
          ],
        },
        {
          id: 3,
          text: 'Chưa duyệt.',
          is_unapproved: true,
          translations: [{ id: 4, text: 'Not yet.', lang: 'eng' }],
        },
        { id: 5, text: 'Không có bản dịch.', translations: [] },
      ],
    }
    const out = parseTatoeba(json, 'A1')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      prompt: 'Đã bảy giờ rồi.',
      promptLang: 'vi',
      reference: "It's already seven o'clock.",
    })
    expect(out[0].attribution).toContain('Tatoeba #1 (duythanh)')
    expect(out[0].attribution).toContain('#2 (CK)')
  })

  it('bỏ câu tiếng Anh quá dài so với cấp độ', () => {
    const long =
      'This is a very long English sentence that clearly goes far beyond the beginner level limit.'
    expect(
      parseTatoeba(
        {
          data: [
            {
              id: 1,
              text: 'Câu.',
              translations: [{ id: 2, text: long, lang: 'eng' }],
            },
          ],
        },
        'A1',
      ),
    ).toEqual([])
  })
})

describe('bộ câu sẵn', () => {
  it('cấp gần nhất trước', () => {
    expect(nearLevels('B1')).toEqual(['B1', 'A2', 'B2', 'A1', 'C1'])
    expect(nearLevels('A1')[1]).toBe('A2')
  })

  it('thiếu câu thì lấy thêm cấp kề bên', () => {
    const items = pickBank('translate', 'B1', 15)
    expect(items).toHaveLength(15)
    expect(new Set(items.map((i) => i.prompt)).size).toBe(15)
  })
})
