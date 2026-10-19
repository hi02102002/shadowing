import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { toWav16k } from './audio.ts'

/** 1.5 giây sóng sin 440Hz dạng webm/opus, giống bản ghi của trình duyệt */
function makeWebm(): Buffer {
  return execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.5',
    '-c:a', 'libopus', '-f', 'webm', 'pipe:1',
  ])
}

describe('toWav16k', () => {
  it('chuyển webm/opus sang WAV 16kHz mono với header đúng kích thước', async () => {
    const { wav, durationMs } = await toWav16k(makeWebm())
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8)
    const dataAt = wav.indexOf('data', 12, 'ascii')
    expect(wav.readUInt32LE(dataAt + 4)).toBe(wav.length - dataAt - 8)
    // fmt chunk: mono, 16000Hz
    const fmtAt = wav.indexOf('fmt ', 12, 'ascii')
    expect(wav.readUInt16LE(fmtAt + 10)).toBe(1)
    expect(wav.readUInt32LE(fmtAt + 12)).toBe(16000)
    expect(durationMs).toBeGreaterThan(1400)
    expect(durationMs).toBeLessThan(1700)
  })

  it('báo lỗi rõ ràng khi input không phải audio', async () => {
    await expect(toWav16k(Buffer.from('not audio at all'))).rejects.toThrow(/ffmpeg/)
  })
})
