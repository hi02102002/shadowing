import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamVilaoTalk } from './vilao-talk.ts'

afterEach(() => vi.unstubAllGlobals())

describe('streamVilaoTalk', () => {
  it('đọc SSE chia chunk và gom delta đúng thứ tự', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                for (const part of [
                  'data: {"choices":[{"delta":{"content":"Hel',
                  'lo"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" there"}}]}\r\n\r\n',
                  'data: [DONE]\r\n\r\n',
                ])
                  controller.enqueue(new TextEncoder().encode(part))
                controller.close()
              },
            }),
          ),
      ),
    )
    let text = ''
    for await (const delta of streamVilaoTalk('system', 'prompt', {
      talkVilaoApiKey: 'test',
      talkVilaoBaseUrl: 'https://api.vilao.ai/v1',
      talkVilaoModel: 'test-model',
    }))
      text += delta
    expect(text).toBe('Hello there')
  })

  it('không coi stream thiếu DONE là một câu trả lời hoàn chỉnh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            'data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n',
          ),
      ),
    )
    const collect = async () => {
      for await (const _ of streamVilaoTalk('system', 'prompt', {
        talkVilaoApiKey: 'test',
        talkVilaoBaseUrl: 'https://api.vilao.ai/v1',
        talkVilaoModel: 'test-model',
      })) {
        /* consume */
      }
    }
    await expect(collect()).rejects.toThrow('trước khi hoàn tất')
  })
})
