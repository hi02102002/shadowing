import { describe, expect, it } from 'vitest'
import { parse } from 'node-html-parser'

import { parseCambridgeListening } from './cambridge-listening'
import { parseTacticsUnit } from './tactics'
import { bneAudioUrl } from './breaking-news'
import { parseEeBlogArticle, parseEeBlogList } from './ee-blog'
import { parseEllloQuiz, parseEllloTranscript } from '../elllo/elllo'
import { coverQuestions } from '../reading/essential'

describe('Cambridge IELTS Listening', () => {
  it('tách 4 section, audio, lời thoại và đáp án gạch chân', () => {
    const section = (
      n: number,
    ) => `<div class="section-rotate">SECTION ${n}</div>
      <img class="speaker-louder" source="data/test1-part${n}.mp3">
      <div class="word-free-cover"><ol class="ul-free-option"><li>A One</li><li>B Two</li></ol>
        <li class="answer-the-questions-section-word-blank" value="B Two">Place ${n}</li></div>
      <div class="script"><table><tr><td>Man:</td><td>Book <u>Canadian</u> tours.</td></tr></table></div>`
    const sections = parseCambridgeListening(
      [1, 2, 3, 4].map(section).join(''),
      'https://example.test/app/',
    )
    expect(sections).toHaveLength(4)
    expect(sections[0].media).toEqual({
      kind: 'audio',
      url: 'https://example.test/app/data/test1-part1.mp3',
    })
    expect(sections[0].transcript).toEqual(['Man:Book [[Canadian]] tours.'])
    expect(sections[0].questions[0]).toMatchObject({
      type: 'heading',
      answers: ['B Two'],
    })
  })

  it('câu nối không có ol lấy các value riêng trong khung làm phương án', () => {
    const cover = parse(`<div class="word-free-cover">
      <li class="answer-the-questions-section-word-blank" value="B There are two">Question 1</li>
      <li class="answer-the-questions-section-word-blank" value="A There is one">Question 2</li></div>`).querySelector(
      'div',
    )!
    const questions = coverQuestions(cover)
    expect(questions.map((q) => q.options)).toEqual([
      ['B There are two', 'A There is one'],
      ['B There are two', 'A There is one'],
    ])
  })

  it('ghép đáp án dù nguồn trộn nháy thẳng và nháy cong', () => {
    const cover = parse(`<div class="word-free-cover">
      <ol class="ul-free-option"><li>F doesn&rsquo;t mix with others</li><li>A rehearses well</li></ol>
      <li class="answer-the-questions-section-word-blank" value="F doesn't mix with others">Percussionist</li>
    </div>`).querySelector('div')!
    expect(coverQuestions(cover)[0]).toMatchObject({
      prompt: 'Percussionist',
      answers: ['F doesn’t mix with others'],
    })
  })
})

describe('Tactics for Listening', () => {
  it('gắn câu hỏi vào track ngay sau nó, bỏ textarea và câu có hình', () => {
    const choice = (prompt: string) =>
      `<div class="word-free-cover"><li answer-index="0" class="answer-the-questions-section">${prompt}<ul class="ul-choose-answer"><li>a. Yes</li><li>b. No</li></ul></li></div>`
    const html = `${choice('First?')}<img class="speaker-louder" source="audio/1.mp3">
      <div class="word-free-cover"><img src="map.png">${choice('Image?')}</div>
      <div class="word-free-cover"><textarea class="answer-the-questions-textarea"></textarea></div>
      ${choice('Second?')}<img class="speaker-louder" source="audio/2.mp3">`
    const sections = parseTacticsUnit(html, 'https://example.test/book/')
    expect(sections).toHaveLength(2)
    expect(sections[0].questions.map((q) => q.prompt)).toEqual(['First?'])
    expect(sections[1].questions.map((q) => q.prompt)).toEqual(['Second?'])
  })
})

describe('nguồn nghe còn lại', () => {
  it('đổi đúng trang Breaking News English thành mp3', () => {
    expect(
      bneAudioUrl('https://breakingnewsenglish.com/2610/261029-story-3.html'),
    ).toBe('https://breakingnewsenglish.com/2610/261029-story-3.mp3')
  })

  it('đọc danh sách và bài English Blog', () => {
    const items = parseEeBlogList({
      data: [{ title: 'At the airport', url: '/blog/airport', level: 'A2' }],
    })
    expect(items[0]).toMatchObject({ title: 'At the airport', levels: ['A2'] })
    const article = parseEeBlogArticle(
      '<h1>At the airport</h1><audio src="audio/my file.mp3"></audio><div class="page-content"><p>Hello there.</p><p>How can I help?</p></div>',
      'https://www.essentialenglish.review/blog/airport',
    )
    expect(article.sections[0]).toMatchObject({
      transcript: ['Hello there.', 'How can I help?'],
    })
    expect(article.sections[0].media).toEqual({
      kind: 'audio',
      url: 'https://www.essentialenglish.review/blog/audio/my%20file.mp3',
    })
  })

  it('đọc mảng quiz JS ELLLO và bỏ nhãn a)', () => {
    const js = `questions[0] = "Where does she live?";
      choices[0][0] = "a) London"; choices[0][1] = "b) Hanoi"; answers[0] = 1;`
    expect(parseEllloQuiz(js)[0]).toMatchObject({
      prompt: 'Where does she live?',
      options: ['London', 'Hanoi'],
      answers: ['Hanoi'],
    })
    expect(
      parseEllloTranscript(
        '<div class="transcript"><p>Man: Hello.</p><p>Woman: Hi.</p></div>',
      ),
    ).toEqual(['Man: Hello.', 'Woman: Hi.'])
  })
})
