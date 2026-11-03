import { describe, expect, it } from 'vitest'

import { parseBneArticle, parseBneIndex } from './breaking-news'
import { parseIeltsTest, parseIeltsUrl } from './cambridge-ielts'
import { EE_READING_BOOKS, expandAnswer, parseEssentialBook, parseEssentialUnit } from './essential'
import { isReadingCorrect } from '#/lib/reading-topics'
import { cefrLevels, parseLinguapressArticle, parseLinguapressIndex } from './linguapress'
import { decodeOnestop, parseOnestopText, parseOnestopTree } from './onestop'

describe('Breaking News English', () => {
  it('đọc mục lục theo level, link tương đối thành tuyệt đối', () => {
    const html = `<ul><li><tt>2026-10-29: </tt><a title="x" href="2610/261029-oxford-street-1.html">Oxford Street &amp; cars</a></li>
      <li><tt>2026-10-22: </tt><a  href="2610/261022-ai-partner-1.html">AI "partner"</a></li></ul>`
    const items = parseBneIndex(html, 4)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      url: 'https://breakingnewsenglish.com/2610/261029-oxford-street-1.html',
      title: 'Oxford Street & cars',
      levels: ['B1', 'B2'],
      date: '2026-10-29',
    })
  })

  it('bỏ ngày trong tiêu đề, tách đoạn theo <br><br>, kể cả khi thiếu </p>', () => {
    const html = `<header><h3>Shopping street pedestrianized &nbsp;<span class="font_small">(29th October 2026)</span></h3></header>
      <article><p>A famous street is now only for people.<br><br>
      Many people are <b>happy</b>.</article>`
    expect(parseBneArticle(html)).toEqual({
      title: 'Shopping street pedestrianized',
      paragraphs: ['A famous street is now only for people.', 'Many people are happy.'],
    })
  })
})

describe('OneStopEnglish', () => {
  it('lấy file đúng thư mục từng mức, bỏ bản Int-Txt hỏng, tiêu đề từ tên file', () => {
    const items = parseOnestopTree({
      tree: [
        { path: 'Texts-SeparatedByReadingLevel/Ele-Txt/Amazon-ele.txt', type: 'blob' },
        { path: 'Texts-SeparatedByReadingLevel/Int-Txt/Amazon-int.txt', type: 'blob' },
        { path: 'Texts-SeparatedByReadingLevel/Int-Txt/Int-Txt/WNL Extreme heat-int.txt', type: 'blob' },
        { path: 'Texts-SeparatedByReadingLevel/Adv-Txt/climate change -adv.txt', type: 'blob' },
        { path: 'Texts-SeparatedByReadingLevel/Adv-Txt/.DS_Store', type: 'blob' },
      ],
    })
    expect(items.map((i) => [i.title, i.levels])).toEqual([
      ['Amazon', ['A2']],
      ['Extreme heat', ['B1']],
      ['climate change', ['B2', 'C1']],
    ])
    expect(items[1].url).toContain('/Int-Txt/Int-Txt/WNL%20Extreme%20heat-int.txt')
  })

  it('bỏ BOM, đưa chữ ghép về dạng thường, đọc được file cp1252', () => {
    const utf8 = new TextEncoder().encode('﻿The ﬁrst line\r\nSecond\r\n\r\n').buffer
    expect(decodeOnestop(utf8)).toBe('The first line\r\nSecond\r\n\r\n')
    const cp1252 = new Uint8Array([0x93, 0x48, 0x69, 0x94]).buffer
    expect(decodeOnestop(cp1252)).toBe('“Hi”')
    expect(parseOnestopText('Intermediate\nOne.\n\nTwo. ', 'x/Amazon-int.txt')).toEqual({ title: 'Amazon', paragraphs: ['One.', 'Two.'] })
  })
})

describe('Linguapress', () => {
  it('quy cấp CEFR về A2–C1', () => {
    expect(cefrLevels('A2.2')).toEqual(['A2'])
    expect(cefrLevels('B1 - B2')).toEqual(['B1', 'B2'])
    expect(cefrLevels('C1 / C2')).toEqual(['C1'])
    expect(cefrLevels('-')).toEqual([])
  })

  it('đọc bảng cấp độ, bỏ dòng không có cấp và bài ngữ pháp', () => {
    const html = `<table class="tbl1">
      <tr><td><a href="../elementary/A2-shakespeare">Shakespeare - with audio</a></td><td>A2</td></tr>
      <tr><td><a href="buffalo-bill">Buffalo Bill</a></td><td>B1<br>and B2</td></tr>
      <tr><td><a href="/grammar/word-stress">Word stress</a></td><td>B2</td></tr>
      <tr><td><a href="scouting">Scouting</a></td><td></td></tr></table>`
    const items = parseLinguapressIndex(html, 'https://linguapress.com/intermediate/grammar-exercise-index')
    expect(items.map((i) => [i.url, i.title, i.levels])).toEqual([
      ['https://linguapress.com/elementary/A2-shakespeare', 'Shakespeare', ['A2']],
      ['https://linguapress.com/intermediate/buffalo-bill', 'Buffalo Bill', ['B1', 'B2']],
    ])
  })

  it('lấy phần bài sau h1, bỏ nhãn, ô giải nghĩa, dừng ở bảng từ', () => {
    const html = `<div class="middle"><h1>Route 66</h1>
      <p>Elementary / preliminary level English</p><p>Places</p>
      <p>In the USA, the car is <span class="bublup">xe hơi</span>part of daily life.</p>
      <h3>A New Road</h3><p>The story began in 1926.</p>
      <p>WORDS</p><p>highway: big road</p></div>`
    expect(parseLinguapressArticle(html)).toEqual({
      title: 'Route 66',
      paragraphs: ['In the USA, the car is part of daily life.', 'A New Road', 'The story began in 1926.'],
    })
  })

  it('báo lỗi với bài điền chỗ trống', () => {
    expect(() => parseLinguapressArticle('<div class="middle"><h1>Cats</h1><p>A <textarea class="ibox"></textarea></p></div>')).toThrow(/điền từ/)
  })
})

describe('essentialenglish.review (Reading for the Real World)', () => {
  it('mục lục: link bài trong sách, bỏ #thứ-tự và link trùng', () => {
    const html = `<a href="/book/reading-for-the-real-world-2/unit-1-bigfoot#1">Unit 1:  BigFoot</a>
      <a href="/book/reading-for-the-real-world-2/unit-1-bigfoot#1">Unit 1: BigFoot</a>
      <a href="/book/other/unit-9">Other</a>`
    expect(parseEssentialBook(html, EE_READING_BOOKS[1])).toEqual([
      {
        source: 'essential',
        url: 'https://www.essentialenglish.review/book/reading-for-the-real-world-2/unit-1-bigfoot',
        title: 'Unit 1: BigFoot',
        levels: ['B1', 'B2'],
        levelLabel: 'Real World 2 · B1–B2',
      },
    ])
  })

  it('lấy bài chính và câu hỏi gốc kèm đáp án (answer-index từ 0, chỗ trống chọn trong hộp từ)', () => {
    const html = `<div class="page-content">
      <div><h3 style="text-align: center;">AMERICAN SUPERSTITIONS</h3><p></p>
        <p>Every culture has superstitions<sup>1</sup>.</p><p>Some people believe them.</p></div>
      <div class="word-free-cover" title="Reading Comprehension: A ‣ Mark each statement">
        <ol><li answer-index="1" class="answer-the-questions-section">Most were about &quot;bad&quot; luck.
          <ul class="ul-choose-answer"><li>True</li><li>False</li></ul></li>
        <li answer-index="0" class="answer-the-questions-section">Main purpose?
          <ul class="ul-choose-answer"><li>a. To describe beliefs</li><li>b. To compare</li></ul></li></ol></div>
      <div class="word-free-cover" title="Summary ‣ Fill in the blanks">
        <ul class="ul-free-option-none"><li>in good-luck</li><li>more often than</li><li>breaking a mirror</li></ul>
        <p>They believe <sup>1</sup> <span class="answer-the-questions-word-free" text="in good-luck">_____</span> things. Young people did it
        <sup>2</sup> <span class="answer-the-questions-word-free" text="more often than">_____</span> older people, not <span class="answer-the-questions-word-free" text="xyz">_____</span>.</p></div>
      <div class="word-free-cover" title="Vocabulary Practice ‣ Fill in"><ol><li answer-index="0" class="answer-the-questions-section">skip
        <ul class="ul-choose-answer"><li>x</li><li>y</li></ul></li></ol></div>
    </div>`
    const a = parseEssentialUnit(html)
    expect(a.title).toBe('American Superstitions')
    expect(a.paragraphs).toEqual(['Every culture has superstitions.', 'Some people believe them.'])
    expect(a.questions?.map((q) => [q.type, q.prompt, q.answers[0], q.options.length])).toEqual([
      ['choice', 'Most were about "bad" luck.', 'False', 2],
      ['choice', 'Main purpose?', 'To describe beliefs', 2],
      ['choice', 'They believe ___ things.', 'in good-luck', 3],
      ['choice', 'Young people did it ___ older people, not ….', 'more often than', 3],
      ['gap', 'Young people did it … older people, not ___.', 'xyz', 0],
    ])
  })
})

describe('Cambridge IELTS (data.json của essentialenglish.review)', () => {
  // bài 1: đoạn văn rồi các nhóm câu; bài 2: nhóm nối tiêu đề đứng trước bài, đoạn A–B trong <ol>,
  // khung câu hỏi thiếu </div> nuốt cả bài sau (lỗi có thật trong dữ liệu)
  const html = `<div class="section-rotate">READING PASSAGE 1</div>
    <p><em>You should spend about 20 minutes on Questions 1-3</em></p>
    <h3 style="text-align: center;"><strong>THE IMPORTANCE OF PLAY</strong></h3>
    <p>Alice builds a kingdom.</p><p>________________<br />* Lego: blocks</p>
    <p><strong>Questions 1–2</strong></p><p>Do the following statements agree with the information?</p>
    <p><em>In boxes 1–2 on your answer sheet, write</em></p>
    <p><strong>TRUE</strong> if it agrees<br /><strong>FALSE</strong> if it contradicts</p>
    <div class="word-free-cover"><ol>
      <li answer-index="2" class="answer-the-questions-section">Alice is six.<ul class="ul-choose-answer"><li>True</li><li>False</li><li>Not Given</li></ul></li>
      <li answer-index="1,3" class="answer-the-questions-section"><ul class="ul-multi-choose-answer" q="2"><li>A &nbsp; one</li><li>B &nbsp; two</li><li>C &nbsp; three</li><li>D &nbsp; four</li></ul></li>
    </ol></div>
    <p><strong>Questions 4–5</strong></p><p>Complete the notes. Write your answers in boxes 4-5 on your answer sheet.</p>
    <div class="word-free-cover"><table><tr><td>Middle Ages</td><td>Brought by the <span class="answer-the-questions-word-free" text="Arabs">_____</span><br />Other line</td></tr></table>
      <ol><li class="answer-the-questions-word-free" text="10(th) September / 10 Sept">Opened on _____ .</li></ol>
    <div class="section-rotate">READING PASSAGE 2</div>
    <p><strong>Questions 6–7</strong></p><p>Choose the correct heading.</p>
    <div class="word-free-cover"><div><ol class="ul-free-option-reformat ul-free-option"><li><strong>i</strong> &nbsp; Early days</li><li><strong>ii</strong> &nbsp; Later years</li><li><strong>iii</strong> &nbsp; Other</li></ol></div>
      <ol><li class="answer-the-questions-section-word-blank" value="ii Later years">Section A</li><li class="answer-the-questions-section-word-blank" value="i  Early days">Section B</li></ol></div>
    <h3><strong>Bikes in Amsterdam</strong></h3><ol><li>The idea began.</li><li>It grew.</li></ol>
    <p><strong>Questions 8</strong></p><div class="word-free-cover"></div>`

  it('tách bài: đoạn văn, bỏ chú thích, đoạn trong <ol> đánh chữ, tiêu đề viết hoa đưa về dạng thường', () => {
    const [p1, p2] = parseIeltsTest(html)
    expect(p1.title).toBe('The Importance of Play')
    expect(p1.paragraphs).toEqual(['Alice builds a kingdom.'])
    expect(p2.title).toBe('Bikes in Amsterdam')
    expect(p2.paragraphs).toEqual(['A. The idea began.', 'B. It grew.'])
  })

  it('câu hỏi gốc: TFNG, chọn nhiều, điền từ trong bảng / trong <li>, nối tiêu đề; hướng dẫn nhóm bỏ câu "answer sheet"', () => {
    const [p1, p2] = parseIeltsTest(html)
    expect(p1.questions.map((q) => [q.type, q.prompt, q.answers])).toEqual([
      ['tfng', 'Alice is six.', ['Not Given']],
      ['multi', '', ['B two', 'D four']],
      ['gap', 'Middle Ages: Brought by the ___', ['Arabs']],
      ['gap', 'Opened on ___ .', ['10th September', '10 September', '10 Sept']],
    ])
    expect(p1.questions[0].instruction).toBe('Do the following statements agree with the information?\nTRUE if it agrees\nFALSE if it contradicts')
    expect(p1.questions[2].instruction).toBe('Complete the notes.')
    expect(p2.questions.map((q) => [q.type, q.prompt, q.answers[0], q.options.length])).toEqual([
      ['heading', 'Section A', 'ii Later years', 3],
      ['heading', 'Section B', 'i Early days', 3],
    ])
  })

  it('đọc link bài trong mục lục', () => {
    expect(parseIeltsUrl('https://www.essentialenglish.review/apps-data/ielts-academic-16/data/data.json#t3p2')).toEqual({ book: 16, test: 3, passage: 2 })
    expect(() => parseIeltsUrl('https://example.com/x.json')).toThrow()
  })

  it('phần trong ngoặc của đáp án là tuỳ chọn', () => {
    expect(expandAnswer('(the) 10(th) day')).toEqual(['the 10th day', 'the 10 day', '10th day', '10 day'])
  })

  it('câu chọn nhiều phải chọn đúng và đủ', () => {
    const q = { type: 'multi', prompt: '', options: ['A', 'B', 'C'], answers: ['A', 'C'], evidence: '', explanation: '' }
    expect(isReadingCorrect(q, 'A|C')).toBe(true)
    expect(isReadingCorrect(q, 'C|A')).toBe(true)
    expect(isReadingCorrect(q, 'A')).toBe(false)
    expect(isReadingCorrect(q, 'A|B')).toBe(false)
  })
})
