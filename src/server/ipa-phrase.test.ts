import { describe, expect, it } from 'vitest'

import { phraseToIpa } from './ipa.ts'

describe('phraseToIpa', () => {
  it('ghép IPA từng từ trong dấu gạch chéo, không cần AI', async () => {
    const ipa = await phraseToIpa('take a break', 'uk')
    expect(ipa).toMatch(/^\/.+ .+ .+\/$/)
  })

  it('có từ không nằm trong từ điển thì trả null để dùng nguồn khác', async () => {
    expect(await phraseToIpa('zzqxv', 'uk')).toBeNull()
    expect(await phraseToIpa('', 'uk')).toBeNull()
  })
})
