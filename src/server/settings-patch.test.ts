import { describe, expect, it } from 'vitest'
import { settingsPatch } from './settings-patch.ts'

describe('settingsPatch', () => {
  it('bỏ ba key đã che thay vì ghi đè key thật bằng undefined', () => {
    const patch = settingsPatch({
      llmApiKey: 'sk-a…aaaa',
      sttApiKey: 'sk-b…bbbb',
      talkVilaoApiKey: 'sk-c…cccc',
      talkVilaoModel: 'chib/gemini-3.8-flash',
    })
    expect(patch).toEqual({ talkVilaoModel: 'chib/gemini-3.8-flash' })
    expect({ llmApiKey: 'original', ...patch }.llmApiKey).toBe('original')
  })

  it('giữ key mới khi người dùng nhập lại', () => {
    expect(settingsPatch({ talkVilaoApiKey: 'new-key' })).toEqual({ talkVilaoApiKey: 'new-key' })
  })
})
