import { describe, expect, it } from 'vitest'

import jfk from './__fixtures__/jfk.whisper.json'
import { segmentWords } from './segment.ts'
import { fromSttResults, fromWhisperCppJson } from './whisper.ts'

describe('fromWhisperCppJson', () => {
  it('đọc đầu ra thật của whisper-cli, bỏ token rỗng', () => {
    const words = fromWhisperCppJson(jfk)
    expect(words[0]).toEqual({ w: 'And', s: 220, e: 330 })
    expect(words.at(-1)?.w).toBe('country.')
    expect(words.map((w) => w.w).join(' ')).toBe(
      'And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country.',
    )
  })

  it('cắt đuôi từ kéo dài qua khoảng lặng', () => {
    const americans = fromWhisperCppJson(jfk).find((w) => w.w === 'Americans,')!
    // gốc 1170 → 3290
    expect(americans.e - americans.s).toBe(1000)
  })

  it('cộng offset, gắn dấu câu lẻ vào từ trước, bỏ [BLANK_AUDIO]', () => {
    const words = fromWhisperCppJson(
      {
        transcription: [
          { offsets: { from: 0, to: 300 }, text: ' Hello' },
          { offsets: { from: 300, to: 350 }, text: ' .' },
          { offsets: { from: 400, to: 900 }, text: ' [BLANK_AUDIO]' },
        ],
      },
      60_000,
    )
    expect(words).toEqual([{ w: 'Hello.', s: 60_000, e: 60_300 }])
  })

  it('tách được thành câu theo dấu câu', () => {
    const sentences = segmentWords(fromWhisperCppJson(jfk), { pauseMs: 1500 })
    expect(sentences.at(-1)?.text.endsWith('country.')).toBe(true)
  })
})

describe('fromSttResults', () => {
  it('ghép dấu câu từ segments vào words, cộng offset từng đoạn', () => {
    const words = fromSttResults([
      {
        offsetMs: 0,
        result: {
          text: "Hi, I'm Tom.",
          words: [
            { word: 'Hi', start: 0, end: 0.3 },
            { word: "I'm", start: 0.4, end: 0.6 },
            { word: 'Tom', start: 0.6, end: 0.9 },
          ],
          segments: [{ start: 0, end: 0.9, text: " Hi, I'm Tom." }],
        },
      },
      {
        offsetMs: 600_000,
        result: {
          text: 'Bye!',
          words: [{ word: 'Bye', start: 1, end: 1.2 }],
          segments: [{ start: 1, end: 1.2, text: 'Bye!' }],
        },
      },
    ])
    expect(words).toEqual([
      { w: 'Hi,', s: 0, e: 300 },
      { w: "I'm", s: 400, e: 600 },
      { w: 'Tom.', s: 600, e: 900 },
      { w: 'Bye!', s: 601_000, e: 601_200 },
    ])
  })

  it('không có timestamp từng từ → chia theo segment', () => {
    const words = fromSttResults([
      { offsetMs: 0, result: { text: 'Good morning.', words: [], segments: [{ start: 1, end: 2, text: ' Good morning.' }] } },
    ])
    expect(words.map((w) => w.w)).toEqual(['Good', 'morning.'])
    expect(words[0].s).toBe(1000)
    expect(words.at(-1)?.e).toBe(2000)
  })
})
