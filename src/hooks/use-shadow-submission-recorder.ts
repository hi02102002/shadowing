import { useCallback, useEffect, useRef, useState } from 'react'

export type ShadowRecordStatus = 'idle' | 'countdown' | 'recording' | 'stopped'

interface UseShadowSubmissionRecorderOptions {
  onAutoStop?: () => void
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return ''
}

/**
 * Tìm stream âm thanh hệ thống (PulseAudio/PipeWire Monitor trên Linux, Stereo Mix trên Windows)
 * Dùng khi getDisplayMedia không trả về audio track (ví dụ trên Electron Desktop Linux hoặc khi chọn Entire Screen).
 */
async function captureSystemAudioFallback(): Promise<MediaStream | null> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter((d) => d.kind === 'audioinput')

    // Tìm thiết bị Monitor / DesktopAudio (âm thanh phát ra từ máy tính / tai nghe / loa)
    const monitorDevice =
      audioInputs.find((d) => d.label.toLowerCase().includes('desktopaudio')) ||
      audioInputs.find((d) => {
        const name = d.label.toLowerCase()
        return (
          (name.includes('earpods') ||
            name.includes('headphone') ||
            name.includes('headset') ||
            name.includes('speaker')) &&
          (name.includes('monitor of') || name.includes('monitor'))
        )
      }) ||
      audioInputs.find((d) => {
        const name = d.label.toLowerCase()
        return (
          name.includes('monitor of') ||
          name.includes('monitor') ||
          name.includes('stereo mix') ||
          name.includes('what u hear') ||
          name.includes('wave out')
        )
      })

    if (monitorDevice) {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: monitorDevice.deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
    }
  } catch (err) {
    console.warn('Không thể thu âm thanh hệ thống qua monitor fallback:', err)
  }
  return null
}

export function useShadowSubmissionRecorder(
  options: UseShadowSubmissionRecorderOptions = {},
) {
  const [status, setStatus] = useState<ShadowRecordStatus>('idle')
  const [countdown, setCountdown] = useState<number>(3)
  const [elapsedMs, setElapsedMs] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [hasTabAudio, setHasTabAudio] = useState<boolean>(true)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)

  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const systemAudioStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  // Giữ tham chiếu các AudioNode để V8 Garbage Collector không ngắt âm thanh
  const audioNodesRef = useRef<unknown[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  // 1. Quản lý Webcam (bật / tắt khung camera)
  const startWebcam = useCallback(async () => {
    try {
      setError(null)
      if (webcamStream) return webcamStream

      // Ưu tiên chọn đúng microphone thật (loại trừ thiết bị Monitor của loa/tai nghe)
      let audioConstraint: boolean | MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const realMic = devices.find(
          (d) =>
            d.kind === 'audioinput' &&
            !d.label.toLowerCase().includes('desktopaudio') &&
            !d.label.toLowerCase().includes('monitor') &&
            !d.label.toLowerCase().includes('stereo mix'),
        )
        if (realMic && realMic.deviceId) {
          audioConstraint = {
            deviceId: { exact: realMic.deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        }
      } catch {
        /* ignore */
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: audioConstraint,
      })
      setWebcamStream(stream)
      return stream
    } catch (err) {
      // Fallback: nếu máy tính không có webcam, thử chỉ xin quyền micro
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        return audioStream
      } catch {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`Không thể mở Camera/Micro: ${msg}`)
        return null
      }
    }
  }, [webcamStream])

  const stopWebcam = useCallback(() => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop())
      setWebcamStream(null)
    }
  }, [webcamStream])

  // Dọn dẹp an toàn khi unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop())
        screenStreamRef.current = null
      }
      if (systemAudioStreamRef.current) {
        systemAudioStreamRef.current.getTracks().forEach((t) => t.stop())
        systemAudioStreamRef.current = null
      }
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try {
          recorderRef.current.stop()
        } catch {
          // ignore
        }
      }
      audioNodesRef.current = []
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
    }
  }, [])

  // 2. Bắt đầu phiên quay: Chọn màn hình/tab -> Đếm ngược 3..2..1 -> Ghi hình
  const startRecordingFlow = useCallback(
    async (startCallback?: () => void) => {
      try {
        setError(null)
        if (recordedUrl) {
          URL.revokeObjectURL(recordedUrl)
          setRecordedUrl(null)
          setRecordedBlob(null)
        }

        // Đảm bảo có mic từ webcam hoặc audio device
        let micStream = webcamStream
        if (!micStream) {
          micStream = await startWebcam()
          if (!micStream) return false
        }

        // Yêu cầu chọn Tab Chrome hoặc Cửa sổ app để quay
        let screenStream: MediaStream
        try {
          const isElectron =
            typeof window !== 'undefined' &&
            (/electron/i.test(navigator.userAgent) ||
              Boolean((window as unknown as { shadowingDesktop?: unknown }).shadowingDesktop))

          const displayMediaOptions: DisplayMediaStreamOptions = isElectron
            ? {
                video: true,
                audio: true,
              }
            : {
                video: {
                  displaySurface: 'browser',
                },
                audio: {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                },
                // @ts-expect-error - Chromium hints
                preferCurrentTab: true,
                selfBrowserSurface: 'include',
                systemAudio: 'include',
                surfaceSwitching: 'include',
              }

          screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
        } catch {
          setError('Bạn đã huỷ chọn màn hình/cửa sổ để quay.')
          return false
        }
        screenStreamRef.current = screenStream

        const micTracks = micStream.getAudioTracks()
        let screenAudioTracks = screenStream.getAudioTracks()

        // Nếu screenStream không có audio track (trên Electron Desktop Linux hoặc khi chọn Entire Screen):
        // Tự động thu âm thanh máy tính qua PipeWire/PulseAudio Monitor source!
        let systemAudioStream: MediaStream | null = null
        if (screenAudioTracks.length === 0) {
          systemAudioStream = await captureSystemAudioFallback()
          if (systemAudioStream) {
            systemAudioStreamRef.current = systemAudioStream
            screenAudioTracks = systemAudioStream.getAudioTracks()
          }
        }

        const hasSound = screenAudioTracks.length > 0
        setHasTabAudio(hasSound)

        let finalAudioTrack: MediaStreamTrack | null = null

        if (hasSound && micTracks.length > 0) {
          // Có CẢ tiếng bài học từ máy tính VÀ tiếng micro -> Mix bằng Web Audio API
          const audioCtx = new AudioContext()
          audioContextRef.current = audioCtx

          // Chrome / Electron tự động suspend AudioContext nếu không được resume
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume()
          }

          const destination = audioCtx.createMediaStreamDestination()
          const micSource = audioCtx.createMediaStreamSource(micStream)
          const computerSource = audioCtx.createMediaStreamSource(
            systemAudioStream ?? screenStream,
          )

          const micGain = audioCtx.createGain()
          micGain.gain.value = 1.0 // Giọng người học rõ ràng

          const computerGain = audioCtx.createGain()
          computerGain.gain.value = 0.85 // Tiếng bài học nền vừa phải

          micSource.connect(micGain).connect(destination)
          computerSource.connect(computerGain).connect(destination)

          // Giữ tham chiếu AudioNodes trong ref để tránh V8 Garbage Collector ngắt luồng
          audioNodesRef.current = [micSource, computerSource, micGain, computerGain, destination]

          finalAudioTrack = destination.stream.getAudioTracks()[0]
        } else if (hasSound) {
          // Chỉ có tiếng bài học / máy tính
          finalAudioTrack = screenAudioTracks[0]
        } else if (micTracks.length > 0) {
          // Chỉ có tiếng micro của bạn
          finalAudioTrack = micTracks[0]
        }

        // Gộp video track từ screenStream và audio track
        const finalTracks: MediaStreamTrack[] = [screenStream.getVideoTracks()[0]]
        if (finalAudioTrack) {
          finalTracks.push(finalAudioTrack)
        }

        const combinedStream = new MediaStream(finalTracks)
        const mimeType = getSupportedMimeType()
        const recorder = new MediaRecorder(
          combinedStream,
          mimeType ? { mimeType } : undefined,
        )
        recorderRef.current = recorder
        chunksRef.current = []

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = () => {
          const blobType = chunksRef.current[0]?.type || mimeType || 'video/webm'
          const blob = new Blob(chunksRef.current, { type: blobType })
          const url = URL.createObjectURL(blob)
          setRecordedBlob(blob)
          setRecordedUrl(url)
          setStatus('stopped')

          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }

          // Dừng track màn hình và track âm thanh máy tính
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop())
            screenStreamRef.current = null
          }
          if (systemAudioStreamRef.current) {
            systemAudioStreamRef.current.getTracks().forEach((t) => t.stop())
            systemAudioStreamRef.current = null
          }
          audioNodesRef.current = []
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            void audioContextRef.current.close().catch(() => {})
            audioContextRef.current = null
          }
        }

        // Nếu người dùng bấm "Stop sharing" trên thanh browser
        screenStream.getVideoTracks()[0].onended = () => {
          if (recorderRef.current && recorderRef.current.state === 'recording') {
            recorderRef.current.stop()
            optionsRef.current.onAutoStop?.()
          }
        }

        // Bắt đầu đếm ngược 3... 2... 1...
        setStatus('countdown')
        setCountdown(3)

        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current)
          countdownTimerRef.current = null
        }

        let remaining = 3
        countdownTimerRef.current = setInterval(() => {
          remaining -= 1
          if (remaining > 0) {
            setCountdown(remaining)
          } else {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current)
              countdownTimerRef.current = null
            }
            setCountdown(0)

            // Bắt đầu ghi hình an toàn, tuyệt đối không gọi trong updater
            if (recorderRef.current && recorderRef.current.state === 'inactive') {
              try {
                recorderRef.current.start(1000)
                setStatus('recording')
                const startTime = Date.now()
                setElapsedMs(0)

                timerRef.current = setInterval(() => {
                  setElapsedMs(Date.now() - startTime)
                }, 200)

                // Kích hoạt callback phát video bất đồng bộ (tránh conflict render)
                window.setTimeout(() => {
                  startCallback?.()
                }, 20)
              } catch (err) {
                console.error('Lỗi khi MediaRecorder.start():', err)
                setError(
                  'Không thể bắt đầu ghi hình: ' +
                    (err instanceof Error ? err.message : String(err)),
                )
                setStatus('idle')
              }
            }
          }
        }, 1000)

        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`Lỗi khi chuẩn bị quay: ${msg}`)
        setStatus('idle')
        return false
      }
    },
    [webcamStream, startWebcam, recordedUrl],
  )

  const stopRecording = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.stop()
      } catch (err) {
        console.warn('Lỗi dừng recorder:', err)
      }
    } else {
      setStatus('idle')
    }
  }, [])

  const resetRecording = useCallback(() => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl)
      setRecordedUrl(null)
      setRecordedBlob(null)
    }
    setStatus('idle')
    setCountdown(3)
    setElapsedMs(0)
    setError(null)
  }, [recordedUrl])

  return {
    status,
    countdown,
    elapsedMs,
    error,
    hasTabAudio,
    recordedUrl,
    recordedBlob,
    webcamStream,
    startWebcam,
    stopWebcam,
    startRecordingFlow,
    stopRecording,
    resetRecording,
  }
}
