import { useEffect, useState } from 'react'

/** Trạng thái cập nhật do app desktop gửi sang (desktop/src/updater.js) */
export interface UpdateState {
  status:
    | 'idle'
    | 'checking'
    | 'up-to-date'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'dev'
  currentVersion: string
  latestVersion: string | null
  /** 0–1 khi đang tải */
  progress: number
  error: string | null
  /** false (macOS chưa ký): không tự cài được, chỉ mở trang tải */
  canInstall: boolean
  releaseUrl: string | null
}

interface DesktopBridge {
  updater: {
    getState: () => Promise<UpdateState>
    check: () => Promise<UpdateState>
    download: () => Promise<UpdateState>
    install: () => Promise<void>
    openRelease: () => Promise<void>
    onState: (callback: (state: UpdateState) => void) => () => void
  }
}

/** Cầu nối từ preload của app desktop; undefined khi chạy bản web */
export const desktopBridge = (): DesktopBridge | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { shadowingDesktop?: DesktopBridge })
        .shadowingDesktop

/** Trạng thái cập nhật của app desktop, null khi chạy bản web */
export function useDesktopUpdate() {
  const [state, setState] = useState<UpdateState | null>(null)
  useEffect(() => {
    const bridge = desktopBridge()
    if (!bridge) return
    void bridge.updater.getState().then(setState)
    return bridge.updater.onState(setState)
  }, [])
  return state
}
