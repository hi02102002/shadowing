import { describe, expect, it } from 'vitest'

import type { HtmlNode } from '#/lib/grammar.ts'
import { parseBook, plainText } from './egiu.ts'

// fixture tự viết, mô phỏng đủ các dạng bài tập trong data.json (không chép nội dung sách)
const RAW = {
  flashcard: [
    {
      en: 'Unit 1: Sample tense (I am doing)',
      desc: 'Present and past',
      image: '',
      reading: [
        {
          type: 'story',
          en: 'A',
          story:
            '<p>Look at this:</p><div class="sample-cover"><div>She <strong>is reading</strong>.</div><img src="data/Unit1-a.jpg" onerror="alert(1)" /></div><script>alert(1)</script><table class="grammar-tbl"><tbody><tr><td>I</td><td>am</td></tr></tbody></table>',
        },
        {
          type: 'faq',
          en: 'exercises',
          story: [
            '<h4>1.1 Complete the sentences.</h4><div class="word-free-cover"><ol>',
            '<li class="answer-the-questions-word-free" value="is reading">She <input class="txt-input-answer" disabled="disabled" value="is reading" /> now.</li>',
            '<li class="answer-the-questions-word-free" value="\'s getting / is getting">It __________ dark.</li>',
            '<li class="answer-the-questions-word-free input-free" value="Where are you going">Ask him.<br />__________ ?</li>',
            '<li class="answer-the-questions-word-free" value="">Go to (2) __________ bed.</li>',
            '</ol></div>',
            '<h4>1.2 Right or wrong?</h4><ol>',
            '<li class="the-questions-R-W" fvalue="" tof="Right">_____ Water <u>boils</u> at 100 degrees.<br />__________</li>',
            '<li class="the-questions-R-W" fvalue="is trying" tof="Wrong">_____ Look! He <u>tries</u> to open it.<br />__________</li>',
            '</ol>',
            '<h4>1.3 Which is correct?</h4><ol>',
            '<li answer-index="1" class="answer-the-questions-section">I <u>phone / I\'ll phone</u> her now.<ul class="ul-choose-answer"><li>I phone</li><li>I\'ll phone</li></ul></li>',
            '<li answer-index="0,2" class="answer-the-questions-section">....... a pen?<ul class="ul-multi-choose-answer" q="3"><li>A. have you got</li><li>B. are you having</li><li>C. do you have</li></ul></li>',
            '</ol>',
            '<h4>1.4 Which sentence goes with which?</h4><div class="div-ol-option-cover"><ol class="ul-free-option-reformat" id="ul-free-option"><li>a) It\'s late.</li><li>b) I\'m hungry.</li></ol></div>',
            '<ol><li class="answer-the-questions-section-word-blank" value="b) I\'m hungry.">I need to eat. __________</li></ol>',
            '<h4>1.5 Complete the conversation.</h4><div class="word-free-cover"><div style="border:2px dotted #D9B867;">A: How is the new job?<br />B: Not bad. <span style="border-bottom: 1.5px dotted;">It\'s going</span> well. But <span class="answer-the-questions-word-free" value="I\'m not enjoying">__________</span> it. (I / not / enjoy)</div></div>',
          ].join(''),
        },
        { type: 'answer key', en: 'Answer Key', story: '' },
      ],
    },
    { en: 'Appendix 2: Sample appendix', desc: 'Appendix', image: '', reading: [] },
    { en: 'Something else', desc: 'Other', image: '', reading: [] },
  ],
}

const flat = (nodes: HtmlNode[]): HtmlNode[] =>
  nodes.flatMap((n) => (typeof n === 'string' || 'blank' in n ? [n] : [n, ...flat(n.children)]))

describe('parseBook', () => {
  const units = parseBook(RAW)
  const [unit] = units

  it('nhận unit và phụ lục, bỏ mục lạ', () => {
    expect(units.map((u) => [u.id, u.order, u.title, u.group])).toEqual([
      ['1', 1, 'Sample tense (I am doing)', 'Present and past'],
      ['appendix-2', 1002, 'Sample appendix', 'Appendix'],
    ])
  })

  it('lọc HTML: bỏ script và thuộc tính lạ, đổi đường dẫn ảnh, <p> → div.para', () => {
    const nodes = flat(unit.sections[0].body)
    const tags = nodes.flatMap((n) => (typeof n === 'string' || 'blank' in n ? [] : [n.tag]))
    expect(tags).not.toContain('script')
    expect(tags).not.toContain('p')
    const img = nodes.find((n) => typeof n !== 'string' && 'tag' in n && n.tag === 'img')
    expect(img).toEqual({ tag: 'img', attrs: { src: '/api/grammar-media/Unit1-a.jpg' }, children: [] })
    expect(JSON.stringify(unit.sections[0].body)).not.toContain('alert')
    expect(plainText(unit.sections[0].body)).toContain('She is reading.')
  })

  it('tách exercise theo <h4>', () => {
    expect(unit.exercises.map((e) => [e.key, e.title])).toEqual([
      ['1.1', 'Complete the sentences.'],
      ['1.2', 'Right or wrong?'],
      ['1.3', 'Which is correct?'],
      ['1.4', 'Which sentence goes with which?'],
      ['1.5', 'Complete the conversation.'],
    ])
  })

  it('điền chỗ trống: câu mẫu, nhiều đáp án, viết câu, đáp án rỗng', () => {
    const items = unit.exercises[0].items
    expect(items[0]).toMatchObject({ kind: 'text', example: true, answers: ['is reading'] })
    expect(items[1]).toMatchObject({ kind: 'text', example: false, long: false, answers: ["'s getting", 'is getting'] })
    expect(items[1].prompt).toBe('It ___ dark.')
    expect(items[2]).toMatchObject({ kind: 'text', long: true, answers: ['Where are you going'] })
    expect(items[3]).toMatchObject({ kind: 'text', answers: ['-'] })
    // mỗi câu đúng một ô nhập
    const blanks = flat(unit.exercises[0].body).filter((n) => typeof n !== 'string' && 'blank' in n)
    expect(blanks).toEqual([{ blank: 0 }, { blank: 1 }, { blank: 2 }, { blank: 3 }])
  })

  it('đúng/sai: bỏ ô "_____", giữ ô sửa câu', () => {
    const ex = unit.exercises[1]
    expect(ex.items[0]).toMatchObject({ kind: 'rightWrong', right: true, fixes: [] })
    expect(ex.items[1]).toMatchObject({ kind: 'rightWrong', right: false, fixes: ['is trying'] })
    expect(ex.items[1].prompt).toBe('Look! He tries to open it.\n___')
  })

  it('trắc nghiệm một / nhiều đáp án, danh sách phương án không nằm trong thân bài', () => {
    const ex = unit.exercises[2]
    expect(ex.items[0]).toMatchObject({ kind: 'choice', options: ['I phone', "I'll phone"], correct: [1], multi: false })
    expect(ex.items[1]).toMatchObject({ kind: 'choice', correct: [0, 2], multi: true })
    expect(JSON.stringify(ex.body)).not.toContain('have you got')
  })

  it('ghép câu lấy phương án từ #ul-free-option', () => {
    expect(unit.exercises[3].items[0]).toMatchObject({
      kind: 'match',
      options: ["a) It's late.", "b) I'm hungry."],
      answers: ["b) I'm hungry."],
    })
  })

  it('chỗ trống giữa hội thoại: lấy cả khối làm ngữ cảnh, khung hội thoại có class boxed', () => {
    const ex = unit.exercises[4]
    expect(ex.items[0].prompt).toBe('A: How is the new job?\nB: Not bad. It\'s going well. But ___ it. (I / not / enjoy)')
    const classes = flat(ex.body).flatMap((n) => (typeof n !== 'string' && 'tag' in n && n.attrs?.class ? [n.attrs.class] : []))
    expect(classes).toContain('boxed')
    expect(classes).toContain('example-answer')
  })
})
