import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { fileRangeResponse } from './file-range'

let dir = ''
afterEach(async () => {
  if (dir) await fs.rm(dir, { recursive: true, force: true })
})

describe('fileRangeResponse', () => {
  it('trả toàn file và các dạng Range với 206/416', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'shadowing-range-'))
    const file = path.join(dir, 'audio.mp3')
    await fs.writeFile(file, Buffer.from('0123456789'))
    const whole = await fileRangeResponse(
      new Request('http://local/audio'),
      file,
      'audio/mpeg',
    )
    expect(whole.status).toBe(200)
    expect(await whole.text()).toBe('0123456789')
    const part = await fileRangeResponse(
      new Request('http://local/audio', { headers: { range: 'bytes=2-5' } }),
      file,
      'audio/mpeg',
    )
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 2-5/10')
    expect(await part.text()).toBe('2345')
    const suffix = await fileRangeResponse(
      new Request('http://local/audio', { headers: { range: 'bytes=-3' } }),
      file,
      'audio/mpeg',
    )
    expect(await suffix.text()).toBe('789')
    const invalid = await fileRangeResponse(
      new Request('http://local/audio', { headers: { range: 'bytes=20-' } }),
      file,
      'audio/mpeg',
    )
    expect(invalid.status).toBe(416)
  })
})
