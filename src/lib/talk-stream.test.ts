import { describe, expect, it } from 'vitest'
import { readTalkStream } from './talk-stream.ts'

const response = (parts: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const part of parts)
          controller.enqueue(new TextEncoder().encode(part))
        controller.close()
      },
    }),
  )

describe('readTalkStream', () => {
  it('ghép dòng JSON bị tách giữa các chunk và chỉ hoàn tất khi có done', async () => {
    const events: unknown[] = []
    await readTalkStream(
      new FormData(),
      (event) => events.push(event),
      new AbortController().signal,
      async () =>
        response([
          '{"type":"user","text":"I went',
          ' to Vung Tau"}\n{"type":"delta","text":"How was it?"}\n',
          '{"type":"done"}\n',
        ]),
    )
    expect(events).toEqual([
      { type: 'user', text: 'I went to Vung Tau' },
      { type: 'delta', text: 'How was it?' },
      { type: 'done' },
    ])
  })

  it('báo lỗi khi luồng bị ngắt trước done', async () => {
    await expect(
      readTalkStream(
        new FormData(),
        () => {},
        new AbortController().signal,
        async () => response(['{"type":"delta","text":"Partial"}\n']),
      ),
    ).rejects.toThrow('bị ngắt')
  })
})
