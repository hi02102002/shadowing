import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AppConfig } from '../config.ts'
import { assessWithAudioLlm } from './audio-assess.ts'

const cfg = {
  llmProvider: 'openai-compatible',
  llmBaseUrl: 'https://proxy.test/v1',
  llmApiKey: 'k',
  llmModel: 'm',
  accent: 'us',
} as AppConfig

const reply = (content: string, status = 200) =>
  new Response(
    status === 200
      ? JSON.stringify({ choices: [{ message: { content } }] })
      : content,
    { status },
  )

const assessment = {
  transcript: 'one',
  summary: 'Tốt',
  fluency: 80,
  mistakes: [],
  drills: [],
}

const bodies = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(
    ([, init]) =>
      JSON.parse((init as RequestInit).body as string) as Record<
        string,
        unknown
      >,
  )

afterEach(() => vi.unstubAllGlobals())

describe('assessWithAudioLlm', () => {
  it('hỏi lại với schema trong prompt khi provider bỏ qua response_format và trả markdown', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        reply('Dưới đây là nhận xét: - **transcript**: "one"'),
      )
      .mockResolvedValueOnce(reply(JSON.stringify(assessment)))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      assessWithAudioLlm(Buffer.from('wav'), 'one', cfg),
    ).resolves.toEqual(assessment)
    const [first, second] = bodies(fetchMock)
    expect(first.response_format).toBeDefined()
    expect(second.response_format).toBeUndefined()
    expect(JSON.stringify(second.messages)).toContain(
      'Chỉ trả về một object JSON',
    )
  })

  it('hỏi lại khi JSON sai cấu trúc', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply('{"transcript": "one"}'))
      .mockResolvedValueOnce(
        reply('```json\n' + JSON.stringify(assessment) + '\n```'),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      assessWithAudioLlm(Buffer.from('wav'), 'one', cfg),
    ).resolves.toEqual(assessment)
  })

  it('chỉ hỏi lại một lần rồi báo lỗi', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(reply('vẫn là markdown')))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      assessWithAudioLlm(Buffer.from('wav'), 'one', cfg),
    ).rejects.toThrow('Model không trả về JSON')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('không hỏi lại khi model báo không nhận audio', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply('Audio is not supported by this model'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      assessWithAudioLlm(Buffer.from('wav'), 'one', cfg),
    ).rejects.toThrow('không nhận audio')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
