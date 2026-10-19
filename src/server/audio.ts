import { spawn } from 'node:child_process'

/**
 * Chuyển bản ghi của trình duyệt (webm/opus, ogg, m4a) sang WAV mono 16kHz.
 * WAV là định dạng `input_audio` mà mọi API tương thích OpenAI đều nhận.
 * Trả về buffer WAV và thời lượng (ms) tính từ số mẫu.
 */
export function toWav16k(
  input: Buffer,
): Promise<{ wav: Buffer; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const ff = spawn(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-sample_fmt',
      's16',
      '-f',
      'wav',
      'pipe:1',
    ])
    const out: Buffer[] = []
    const err: Buffer[] = []
    ff.stdout.on('data', (d: Buffer) => out.push(d))
    ff.stderr.on('data', (d: Buffer) => err.push(d))
    ff.on('error', (e: NodeJS.ErrnoException) =>
      reject(
        e.code === 'ENOENT'
          ? new Error('Không tìm thấy ffmpeg. Cài ffmpeg hoặc đặt FFMPEG_PATH.')
          : e,
      ),
    )
    ff.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `ffmpeg lỗi khi chuyển audio: ${Buffer.concat(err).toString().trim().slice(0, 200)}`,
          ),
        )
        return
      }
      const wav = Buffer.concat(out)
      // ghi ra pipe nên ffmpeg không quay lại điền kích thước vào header → tự sửa
      const dataAt = wav.indexOf('data', 12, 'ascii')
      if (wav.length < 44 || dataAt < 0) {
        reject(new Error('ffmpeg trả về WAV không hợp lệ'))
        return
      }
      const dataBytes = wav.length - (dataAt + 8)
      wav.writeUInt32LE(wav.length - 8, 4)
      wav.writeUInt32LE(dataBytes, dataAt + 4)
      // 16-bit mono 16kHz = 32000 byte/giây
      resolve({ wav, durationMs: Math.round((dataBytes / 32000) * 1000) })
    })
    ff.stdin.on('error', () => {
      /* ffmpeg có thể đóng stdin sớm khi input hỏng; lỗi thật sẽ ra ở 'close' */
    })
    ff.stdin.end(input)
  })
}
