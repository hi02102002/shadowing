export function selectDisplayMediaStreams(source, request, platform) {
  if (!request.audioRequested) return { video: source }

  // Electron only supports the system loopback stream on Windows. Capture the
  // app's own audio on Linux/macOS so lesson playback is included in the video.
  if (platform === 'win32') return { video: source, audio: 'loopback' }
  if (request.frame) {
    return { video: source, audio: request.frame, enableLocalEcho: true }
  }

  // The renderer can still try a monitor input when the requesting frame is gone.
  return { video: source }
}
