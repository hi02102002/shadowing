import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { AppConfig } from '../config.ts'
import { structured } from './provider.ts'

const chat = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/ai', () => ({ chat }))

const cfg = {
  llmProvider: 'openai-compatible',
  llmBaseUrl: 'https://proxy.test/v1',
  llmApiKey: 'k',
  llmModel: 'm',
  accent: 'us',
} as AppConfig

const schema = z.object({ summary: z.string(), fluency: z.number() })
const ask = () => structured({ system: 'sys', prompt: 'p', schema, cfg })

beforeEach(() => chat.mockReset())

describe('structured', () => {
  it('hỏi lại với schema trong prompt khi model trả markdown thay vì JSON', async () => {
    chat
      .mockRejectedValueOnce(
        new Error(
          'Failed to parse structured output as JSON. Content: **Nhận xét chung:** Bạn làm rất tốt!',
        ),
      )
      .mockResolvedValueOnce({
        text: 'Đây là kết quả:\n```json\n{"summary":"Tốt","fluency":80}\n```',
      })

    await expect(ask()).resolves.toEqual({ summary: 'Tốt', fluency: 80 })
    const retry = chat.mock.calls[1][0] as Record<string, unknown>
    expect(retry.outputSchema).toBeUndefined()
    expect(retry.stream).toBe(false)
    expect(String(retry.systemPrompts)).toContain('Chỉ trả về một object JSON')
  })

  it('hỏi lại khi JSON thiếu trường', async () => {
    chat
      .mockResolvedValueOnce({ summary: 'Tốt' })
      .mockResolvedValueOnce({ text: '{"summary":"Tốt","fluency":70}' })

    await expect(ask()).resolves.toEqual({ summary: 'Tốt', fluency: 70 })
  })

  it('báo lỗi rõ ràng khi hỏi lại vẫn không ra JSON', async () => {
    chat
      .mockRejectedValueOnce(
        new Error('Failed to parse structured output as JSON'),
      )
      .mockResolvedValueOnce({ text: '**Nhận xét:** vẫn là markdown' })

    await expect(ask()).rejects.toThrow('Model không trả về JSON đúng cấu trúc')
    expect(chat).toHaveBeenCalledTimes(2)
  })

  it('không hỏi lại với lỗi mạng / API key', async () => {
    chat.mockRejectedValueOnce(new Error('401 Unauthorized'))

    await expect(ask()).rejects.toThrow('401')
    expect(chat).toHaveBeenCalledTimes(1)
  })
})
