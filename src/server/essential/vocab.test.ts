import { describe, expect, it } from 'vitest'

import type { VocabBook } from './books.ts'
import { VOCAB_BOOKS, findBook } from './books.ts'
import { parseBook, urlFriendlyFull } from './vocab.ts'

// fixture tự viết, mô phỏng cấu trúc data.json của từng dạng sách (không chép nội dung sách)
const WORDLIST_BOOK: VocabBook = {
  slug: 'sample-wordlist',
  title: 'Sample',
  series: 'Sample',
  format: 'wordlist',
  images: true,
}

describe('urlFriendlyFull', () => {
  it('chuẩn hoá tên unit thành tên thư mục như site', () => {
    expect(urlFriendlyFull('Unit 1')).toBe('unit-1')
    expect(urlFriendlyFull('Word 1 - Word 10')).toBe('word-1-word-10')
    expect(urlFriendlyFull('Lesson 1 - The Sun, the Moon, and the Bat')).toBe('lesson-1-the-sun-the-moon-and-the-bat')
    expect(urlFriendlyFull("Unit 25: Joe's Pond!")).toBe('unit-25-joes-pond')
    expect(urlFriendlyFull('give up')).toBe('give-up')
  })
})

describe('parseBook — dạng wordlist', () => {
  const raw = {
    flashcard: [
      {
        en: 'Unit 1',
        wordlist: [
          {
            en: 'brave',
            pron: '[breɪv] adj.',
            desc: 'Someone who is brave is not afraid.',
            exam: 'The <strong>brave </strong>girl didn&rsquo;t cry.',
            image: '101.jpg',
            sound: '101.mp3',
          },
          { en: 'Word 2: Lucid', pron: '[LOO-sid]', desc: 'Clear.', exam: '<div>Easy to <em>understand</em>.</div>', image: '', sound: '102.mp3' },
          { en: '', pron: '', desc: '', exam: '' },
        ],
        reading: [],
      },
      { en: 'Index', wordlist: [] },
    ],
  }

  it('tách IPA/từ loại, bỏ HTML và tạo URL ảnh/audio theo unit', () => {
    const units = parseBook(WORDLIST_BOOK, raw)
    expect(units).toHaveLength(1)
    const [brave, lucid] = units[0].words
    expect(units[0].words).toHaveLength(2)
    expect(brave).toEqual({
      word: 'brave',
      ipa: 'breɪv',
      pos: 'adj.',
      definition: 'Someone who is brave is not afraid.',
      example: 'The brave girl didn’t cry.',
      imageUrl: '/api/essential-media/sample-wordlist/unit-1/101.jpg',
      audioUrl: '/api/essential-media/sample-wordlist/unit-1/101.mp3',
      guid: 'ee:sample-wordlist:101.mp3:brave',
    })
    // Verbal Advantage: bỏ tiền tố "Word N:", không có ảnh
    expect(lucid).toMatchObject({ word: 'Lucid', ipa: 'LOO-sid', pos: null, example: 'Easy to understand.', imageUrl: null })
  })

  it('sách không có ảnh thì không gắn imageUrl', () => {
    const [unit] = parseBook({ ...WORDLIST_BOOK, images: false }, raw)
    expect(unit.words[0].imageUrl).toBeNull()
  })

  it('không có câu ví dụ thì lấy câu trong bài đọc (ưu tiên câu có từ in đậm)', () => {
    const [unit] = parseBook(WORDLIST_BOOK, {
      flashcard: [
        {
          en: 'Unit 1: Family',
          wordlist: [{ en: 'cousin', image: '1.jpg' }, { en: 'uncle', image: '2.jpg' }, { en: 'niece', image: '3.jpg' }],
          reading: [
            {
              story:
                '<p>My uncle lives far away.</p><ul><li>Tom is my <strong>uncle</strong>.</li><li>Ann is my <strong>cousin.</strong></li></ul>',
            },
          ],
        },
      ],
    })
    expect(unit.words.map((w) => w.example)).toEqual(['Ann is my cousin.', 'Tom is my uncle.', null])
    expect(unit.words.every((w) => w.definition === '' && w.audioUrl === null)).toBe(true)
  })
})

describe('parseBook — dạng html (2nd Edition)', () => {
  const book: VocabBook = { ...WORDLIST_BOOK, slug: 'sample-html', format: 'html' }
  const raw = {
    flashcard: [
      {
        en: 'Unit 1: A Trip',
        reading:
          '<p class="section-rotate">Word List</p><ul class="wordlist">' +
          '<li img="hike.jpg" pro="haik" word="hike"><div><em>v.</em> To <strong>hike</strong> is to walk far.</div><div>We <strong>hiked</strong> up the hill.</div></li>' +
          '<li img="give_up.jpg" pro="" word="give up"><div><em>phr. v.</em> To stop trying.</div></li>' +
          '</ul>',
      },
      { en: 'Appendix', reading: '<p>No words here</p>' },
    ],
  }

  it('đọc từ trong <li word>, ảnh/audio ở data/wordlist', () => {
    const units = parseBook(book, raw)
    expect(units).toHaveLength(1)
    expect(units[0].title).toBe('Unit 1: A Trip')
    expect(units[0].words).toEqual([
      {
        word: 'hike',
        ipa: 'haik',
        pos: 'v.',
        definition: 'To hike is to walk far.',
        example: 'We hiked up the hill.',
        imageUrl: '/api/essential-media/sample-html/_/hike.jpg',
        audioUrl: '/api/essential-media/sample-html/_/hike.mp3',
        guid: 'ee:sample-html:hike',
      },
      {
        word: 'give up',
        ipa: null,
        pos: 'phr. v.',
        definition: 'To stop trying.',
        example: null,
        imageUrl: '/api/essential-media/sample-html/_/give_up.jpg',
        audioUrl: '/api/essential-media/sample-html/_/give-up.mp3',
        guid: 'ee:sample-html:give up',
      },
    ])
  })
})

describe('VOCAB_BOOKS', () => {
  it('slug không trùng và tìm được theo slug', () => {
    expect(new Set(VOCAB_BOOKS.map((b) => b.slug)).size).toBe(VOCAB_BOOKS.length)
    expect(findBook('4000-essential-english-words-2-2nd-edition')?.dataSlug).toBe(
      '4000-essential-english-words-3-2nd-edition',
    )
    expect(findBook('nope')).toBeUndefined()
  })
})
