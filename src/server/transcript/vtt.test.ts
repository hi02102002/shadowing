import { describe, expect, it } from 'vitest'

import { parseJson3 } from './json3.ts'
import { subtitleToJson3 } from './vtt.ts'

const VTT = `WEBVTT

1
00:00:01.245 --> 00:00:03.915
Hello, my name is Julie.

2
00:00:05.575 --> 00:00:07.295 align:start position:0%
I am <c>from</c> America.

01:02:03.000 --> 01:02:04.500
Ingrid and Astrid
are Cecilia's daughters.
`

describe('subtitleToJson3', () => {
  it('đọc cue, bỏ số thứ tự, thẻ và cue settings', () => {
    expect(subtitleToJson3(VTT).events).toEqual([
      { tStartMs: 1245, dDurationMs: 2670, segs: [{ utf8: 'Hello, my name is Julie.' }] },
      { tStartMs: 5575, dDurationMs: 1720, segs: [{ utf8: 'I am from America.' }] },
      { tStartMs: 3723000, dDurationMs: 1500, segs: [{ utf8: "Ingrid and Astrid are Cecilia's daughters." }] },
    ])
  })

  it('dùng được với parseJson3', () => {
    const { words, hasWordTiming } = parseJson3(subtitleToJson3(VTT))
    expect(hasWordTiming).toBe(false)
    expect(words[0]).toMatchObject({ w: 'Hello,', s: 1245 })
    expect(words.at(-1)?.e).toBe(3724500)
  })
})

const SRT = `\uFEFF1\r
00:00:01,245 --> 00:00:03,915\r
<i>Hello,</i> my name is Julie.\r
\r
2\r
00:00:05,575 --> 00:00:07,295\r
{\\an8}I am from America.\r
`

describe('subtitleToJson3 (SRT)', () => {
  it('đọc SRT có BOM, CRLF, thẻ <i> và {\\an8}', () => {
    expect(subtitleToJson3(SRT).events).toEqual([
      { tStartMs: 1245, dDurationMs: 2670, segs: [{ utf8: 'Hello, my name is Julie.' }] },
      { tStartMs: 5575, dDurationMs: 1720, segs: [{ utf8: 'I am from America.' }] },
    ])
  })
})
