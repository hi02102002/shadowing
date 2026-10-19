import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error'

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))
}

/**
 * Ghi âm micro bằng MediaRecorder, kèm mức âm lượng realtime (0..1) để vẽ meter.
 * Giữ stream giữa các lần ghi để không bị hỏi quyền lại.
 */
export function useRecorder(opts: { maxMs?: number; onStop?: (blob: Blob) => void } = {}) {
  const { maxMs = 60_000 } = opts
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onStopRef = useRef(opts.onStop)
  onStopRef.current = opts.onStop

  const ensureStream = useCallback(async () => {
    if (streamRef.current?.active) return streamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    streamRef.current = stream
    return stream
  }, [])

  const stopMeter = () => {
    cancelAnimationFrame(rafRef.current)
    setLevel(0)
  }

  const start = useCallback(async () => {
    if (recRef.current?.state === 'recording') return
    setError(null)
    setStatus('requesting')
    try {
      const stream = await ensureStream()
      const mimeType = pickMime()
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64_000 } : undefined)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        clearTimeout(timeoutRef.current)
        stopMeter()
        const b = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' })
        setBlob(b)
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(b)
        })
        setStatus('stopped')
        onStopRef.current?.(b)
      }
      recRef.current = rec

      // meter âm lượng
      ctxRef.current ??= new AudioContext()
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') await ctx.resume()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      const startedAt = performance.now()
      const loop = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
        setLevel(Math.min(1, peak / 64))
        setElapsedMs(performance.now() - startedAt)
        rafRef.current = requestAnimationFrame(loop)
      }
      loop()

      rec.start(250)
      setStatus('recording')
      timeoutRef.current = setTimeout(() => rec.state === 'recording' && rec.stop(), maxMs)
    } catch (err) {
      stopMeter()
      setStatus('error')
      const name = err instanceof DOMException ? err.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Bạn chưa cho phép dùng micro. Bấm vào biểu tượng ổ khoá trên thanh địa chỉ để cấp quyền.'
          : name === 'NotFoundError'
            ? 'Không tìm thấy micro.'
            : err instanceof Error
              ? err.message
              : String(err),
      )
    }
  }, [ensureStream, maxMs])

  const stop = useCallback(() => {
    if (recRef.current?.state === 'recording') recRef.current.stop()
  }, [])

  const reset = useCallback(() => {
    setBlob(null)
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setStatus('idle')
    setElapsedMs(0)
  }, [])

  useEffect(
    () => () => {
      clearTimeout(timeoutRef.current)
      cancelAnimationFrame(rafRef.current)
      if (recRef.current?.state === 'recording') recRef.current.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void ctxRef.current?.close()
    },
    [],
  )

  return { status, error, blob, url, level, elapsedMs, start, stop, reset, recording: status === 'recording' }
}
